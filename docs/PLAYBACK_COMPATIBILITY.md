# Story Time — Playback Compatibility Runbook

This document is the source of truth for how movies, episodes, trailers and
podcasts are uploaded, transcoded and streamed on Story Time. It exists so
that:

1. New creators never re-hit the same playback problems.
2. Apple FairPlay Streaming, Google Widevine and Microsoft PlayReady audits
   can be completed with a single referenceable architecture.
3. Operators can debug a broken title in minutes instead of hours.

The system is modelled on the patterns Netflix and Amazon Prime use today:
a server-side **manifest builder** that emits a per-device source list,
**per-key-system DRM proxies**, and a **prewarm pipeline** that turns the
play button into an instantaneous action.

---

## 1. End-to-end flow

```
       ┌──────────────────────────┐
Upload │  S3 (presigned PUT)      │
 ──►   │  -or- multipart POST     │
       └────────────┬─────────────┘
                    │  after()
                    ▼
       ┌──────────────────────────┐
       │ Cloudflare Stream copy   │  requireSignedURLs, allowedOrigins,
       │ (HLS + DASH + MP4 + JPG) │  watermark profile, auto thumbnails
       └────────────┬─────────────┘
                    │ webhook (HMAC) or  cron reconcile
                    ▼
       ┌──────────────────────────┐
       │ StreamAsset row          │  uid, hlsUrl, dashUrl, mp4Url, status
       │ syncLinkedEntities()     │  videoUrl / trailerUrl / posterUrl
       └────────────┬─────────────┘
                    │
                    ▼
       ┌──────────────────────────┐
       │ buildPlaybackManifest()  │  ordered sources, DRM descriptors,
       │  /api/.../playback-bundle│  subtitles, thumbnails, ABR hints,
       └────────────┬─────────────┘  instant-start hints, compliance
                    │
                    ▼
       ┌──────────────────────────┐
       │ <StorytimeMediaPlayer>   │  Vidstack + hls.js (Widevine / clear)
       │  prewarmFromManifest()   │  Native HLS + FairPlay (Apple)
       │  createFairPlayKeyHandler│  Per-source ABR, retry, mini-player
       └──────────────────────────┘
```

---

## 2. Supported platforms

| Platform                 | Protocol      | DRM key system                | Notes |
|--------------------------|---------------|-------------------------------|-------|
| iOS / iPadOS / tvOS      | HLS (native)  | `com.apple.fps`               | FairPlay required for App Store builds |
| macOS Safari             | HLS (native)  | `com.apple.fps.1_0`           | Falls back to clear HLS in dev |
| Chrome / Edge desktop    | DASH + HLS    | `com.widevine.alpha`          | HW_SECURE_ALL for 1080p+ |
| Android Chrome           | DASH + HLS    | `com.widevine.alpha`          | L1 required for HD/UHD |
| Firefox                  | DASH + HLS    | `com.widevine.alpha`          | SW decode only on most builds |
| Samsung Internet         | DASH + HLS    | `com.widevine.alpha`          | |
| Edge Legacy / Xbox       | DASH + Smooth | `com.microsoft.playready`     | SOAP licenses |
| Smart TVs (Tizen, WebOS) | HLS or DASH   | Widevine or PlayReady         | Detected by UA |
| Apple TV apps            | HLS           | FairPlay                      | Use AVPlayer DRM hooks |
| Roku                     | HLS           | Widevine via Roku DRM         | Future native app |

The **client-side picker** (`pickSupportedSource()` in
[`src/lib/playback/client-drm.ts`](../src/lib/playback/client-drm.ts)) walks
the manifest and chooses the highest-priority source the device can play,
falling back gracefully (FairPlay → clear HLS → Widevine DASH → MP4).

---

## 3. Upload & transcode

* Every upload lands in S3 first via `/api/upload/content-media/{presign,
  complete,route}`. The complete handler then fires Cloudflare Stream's
  `/stream/copy` job in the background via `after()`.
* The Stream copy request now opts in to:
  * `requireSignedURLs: true` when `CLOUDFLARE_STREAM_SIGNED_URLS=true`,
  * `allowedOrigins` from `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` (CSV),
  * a watermark profile from `CLOUDFLARE_STREAM_WATERMARK_PROFILE_ID`,
  * `thumbnailTimestampPct: 0.05` so the auto poster is from 5% in.
* On completion, Cloudflare POSTs `/api/stream/webhook` with an HMAC
  signature (`CLOUDFLARE_STREAM_WEBHOOK_SECRET`). We `upsertStreamAsset`
  and call `syncLinkedEntitiesAfterStreamReady` which rewrites the
  catalogue row's `videoUrl` / `trailerUrl` / `posterUrl` to Stream URLs.

### Webhook resilience

Webhooks can be lost. To prevent stuck content, the platform now runs:

* a **cron reconciler** at `/api/cron/playback-reconcile` (every 10
  minutes via `vercel.json`),
* a **manual reconciler** via `npm run playback:reconcile`,
* a **self-test** via `npm run playback:self-test [contentId]` that walks
  the entire pipeline end-to-end and prints a JSON report.

---

## 4. The unified playback manifest

`/api/content/[id]/playback-bundle` now returns a fully-described
`PlaybackManifest` alongside the legacy `playback` field. Shape:

```ts
{
  sources: [
    { src, type, container: "hls" | "dash" | "mp4", drm?: { keySystem, licenseUrl, certificateUrl? }, priority, warmupOrigins },
    ...
  ],
  subtitles: [{ id, language, label, src, type: "text/vtt", isDefault }],
  audioTracks: [{ id, language, label, channels }],
  thumbnails: { src, type: "text/vtt", spriteUrl },
  abr: { startBitrate, maxBitrateMobile, bufferGoalSeconds, maxBufferAheadSeconds },
  instantStart: { preload, warmFirstSegment, firstSegmentUrl, autoplayAllowed },
  compliance: { signedPlayback, expiresInSeconds, concurrentSessionsEnforced, watermarkActive, hardwareDrm, fairPlayReady },
  session: { sessionId, refreshAt }
}
```

Every DRM descriptor points at our **proxy routes**, never at the upstream
license server directly:

* `POST /api/content/drm/widevine/license?c={contentId}`
* `POST /api/content/drm/playready/license?c={contentId}`
* `POST /api/content/drm/fairplay/license?c={contentId}` (SPC → CKC)
* `GET  /api/content/drm/fairplay/certificate?c={contentId}`

The proxies:

* require an authenticated viewer (`getServerSession`),
* check entitlements via `getViewerPlaybackState`,
* rate-limit per IP/user,
* attach `X-Storytime-User` + `X-Storytime-Content` so the upstream key
  server can mint per-session, per-content licenses (watermarking,
  concurrent-session enforcement, geo locks).

The legacy `/api/content/drm-license` route still works and forwards to
Widevine's upstream so older clients keep playing.

---

## 5. Instant-start engine

Three knobs combine to put play-button-to-paint under 300ms on warm
sessions:

1. **Manifest hydration** — `fetchPlaybackBundle` calls
   `prewarmFromManifest` as soon as the JSON resolves. This opens
   `preconnect` to the CDN origin, prefetches the manifest URL and (on
   FairPlay) prefetches the application certificate.
2. **First segment warm-up** — when Cloudflare Stream is the source,
   `instantStart.firstSegmentUrl` is hinted and the player warms the
   first init segment in parallel with the manifest.
3. **Player code-split** — `preloadPlayerModule()` is fired on hover and
   on the detail-page mount; by the time the user clicks **Play**, the
   Vidstack chunk is already executing.

Trailers use the same pipeline (`trailer=1`), so the autoplay trailer on
the detail page benefits from all three knobs too.

---

## 6. Operating runbook

### "Video unavailable" / "Signed playback could not be established"

1. `npm run stream:verify` — confirms Cloudflare env, webhook URL, and
   that the secret matches.
2. `npm run playback:self-test <contentId>` — confirms the catalogue
   row, the Stream asset, the manifest payload and (when enabled) a
   signed URL.
3. `npm run playback:reconcile` — drains any rows whose webhook never
   arrived.

### Apple FairPlay submission check

* Confirm `STORYTIME_FAIRPLAY_CERTIFICATE_URL` returns the operator
  application certificate (DER bytes).
* Confirm `STORYTIME_FAIRPLAY_LICENSE_URL` accepts an SPC and returns a
  CKC.
* `compliance.fairPlayReady` should be `true` in the playback-bundle.
* Encryption scheme must be `cbcs` (already set in the descriptor).
* Application Transport Security: all FairPlay URLs are HTTPS and our
  origin (no third-party JS license code paths).

### Adding a new key server

Set the per-system env vars:

```
STORYTIME_WIDEVINE_LICENSE_URL=https://keyos.example.com/widevine
STORYTIME_WIDEVINE_AUTH_TOKEN=...
STORYTIME_PLAYREADY_LICENSE_URL=https://keyos.example.com/playready
STORYTIME_FAIRPLAY_LICENSE_URL=https://keyos.example.com/fps
STORYTIME_FAIRPLAY_CERTIFICATE_URL=https://keyos.example.com/fps/cert
```

Then redeploy. The manifest will start emitting DRM descriptors and the
player will negotiate the right key system per device on its own — no
client code changes required.

---

## 7. Code map

| Area                           | Path |
|--------------------------------|------|
| Manifest types                 | `src/lib/playback/manifest-types.ts` |
| Manifest builder               | `src/lib/playback/manifest.ts` |
| Server DRM config              | `src/lib/playback/drm-config.ts` |
| Client DRM helpers             | `src/lib/playback/client-drm.ts` |
| Instant-start prewarm          | `src/lib/playback/instant-start.ts` |
| Stream reconciler              | `src/lib/playback/stream-reconciler.ts` |
| Playback bundle API            | `src/app/api/content/[id]/playback-bundle/route.ts` |
| Multi-system DRM proxies       | `src/app/api/content/drm/*` |
| Cron reconciler                | `src/app/api/cron/playback-reconcile/route.ts` |
| Player                         | `src/components/player/storytime-media-player.tsx` |
| Self-test script               | `scripts/playback-self-test.ts` |
| Manual reconciler              | `scripts/playback-reconcile.ts` |
