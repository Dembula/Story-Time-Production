# Playback, Upload & DRM Architecture

How a film travels from a creator's upload to instant, protected playback on any
device — and exactly what must be configured for Apple FairPlay, Google Widevine,
and Microsoft PlayReady approval.

This is the reference for the "playback works everywhere, instantly, and securely"
guarantee. It is written so that **future creators never hit a black screen**: the
pipeline self-heals, falls back gracefully, and surfaces a clear "processing" state
instead of "video unavailable".

---

## 1. The end-to-end pipeline

```
Creator upload ─► S3/R2 (private)
        │
        ├─ presigned PUT (browser → storage)          [/api/upload/content-media/presign]
        └─ finalize                                     [/api/upload/content-media/complete]
                │  after() background job
                ▼
        Cloudflare Stream ingest (copy from presigned GET)   [lib/cloudflare-stream.ts]
                │  transcode → adaptive HLS (+DASH), thumbnails
                ▼
        StreamAsset row (status: queued → inprogress → ready) [lib/stream-asset-store.ts]
                │
                ├─ webhook       [/api/stream/webhook]   (primary, instant)
                └─ reconcile     [/api/stream/reconcile]  (backstop cron + on-demand)
                        │ when ready → point Content.videoUrl at Stream HLS
                        ▼
        Viewer presses play
                │
                ▼
        playback-bundle resolves best source            [/api/content/[id]/playback-bundle]
                │  signed HLS (when enabled) → Stream HLS → presigned direct fallback
                ▼
        StorytimeMediaPlayer (Vidstack)
                ├─ hls.js engine → Widevine / PlayReady (EME)   [content-capture-protection/hls-drm.ts]
                └─ native engine → Apple FairPlay (EME)          [content-capture-protection/fairplay.ts]
```

### Why this is reliable

- **Private buckets work.** Cloudflare ingests via a short-lived presigned GET, so
  the storage bucket never has to be public. (Previously a private upload could
  never be transcoded — the copy step would 403.)
- **No single point of failure for "ready".** If the Stream webhook is missed
  (mis-config, downtime), `reconcileStreamAsset` polls Cloudflare on the next
  playback request and every 5 minutes via cron, then links the catalogue row.
- **Instant by default.** On upload, the original master is playable immediately via
  a presigned direct source while adaptive HLS finishes — unless signed/DRM playback
  is enforced, in which case the viewer sees a clean "Preparing your film…" state and
  the player auto-starts the moment HLS is ready (`refetchInterval`).

---

## 2. Device & player compatibility

The player is **Vidstack**, which picks the right engine per device:

| Device / browser            | Engine            | Streaming | DRM system           |
| --------------------------- | ----------------- | --------- | -------------------- |
| Safari, iOS, iPadOS, tvOS   | native `<video>`  | HLS       | **Apple FairPlay**   |
| Chrome, Edge, Android       | hls.js (EME)      | HLS       | **Widevine**         |
| Firefox                     | hls.js (EME)      | HLS       | **Widevine**         |
| Windows / Edge (PlayReady)  | hls.js (EME)      | HLS       | **PlayReady**        |
| Smart TVs / consoles        | native or hls.js  | HLS       | Widevine / PlayReady |

HLS with `cbcs` (sample-AES) encryption is the one packaging that satisfies all
three CDMs, which is why a single HLS ladder covers every platform. A DASH manifest
URL is also exposed (`playbackAlternatives.dash`) for clients that prefer it.

Other compatibility details handled by the player:

- `playsinline` / `webkit-playsinline` on iOS, native fullscreen handoff.
- Landscape orientation lock on phones during playback.
- Picture-in-picture, AirPlay/Chromecast (via Vidstack), keyboard + remote input.
- Subtitle/caption `<Track>`s rendered from `ContentSubtitle` (accessibility/CC).
- Adaptive bitrate (`startLevel: -1`) for instant first frame + auto quality.
- Automatic recovery from transient media/network errors (no hard failure).

---

## 3. Instant playback ("pre-loading")

Truly pre-loading every film is neither possible nor desirable. Instead we do what
Netflix / Prime Video do — **predictively warm the things that make the first frame
appear instantly** the moment intent is detected:

- On card hover/focus (`lib/prefetch/engine.ts` → `prefetchOnContentHover`):
  route prefetch, poster decode, **HLS manifest warm** (`<link rel=prefetch>` +
  fetch), `preconnect`/`dns-prefetch` to the media origin, and a metadata fetch.
- On click (`preparePlaybackStart`): the player JS chunk, the watch route, the
  manifest, and the playback bundle are all warmed before navigation.
- The watch route resumes at the saved `WatchProgress` position immediately.

Result: by the time the watch screen mounts, the manifest and metadata are already
in cache and the player starts in milliseconds.

---

## 4. DRM configuration (FairPlay / Widevine / PlayReady)

DRM is **off by default** (standard capture-protection mode). Turn it on only once
you have an encrypted HLS ladder and a license server. All three CDMs are wired:

### Required environment

```bash
# Turn on DRM mode
CAPTURE_PROTECTION_MODE="drm"
NEXT_PUBLIC_CAPTURE_PROTECTION_MODE="drm"
NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED="true"

# License server proxied by /api/content/drm-license (Widevine, PlayReady, FairPlay CKC)
STORYTIME_DRM_LICENSE_URL="https://license.your-drm-provider.com/..."
STORYTIME_DRM_AUTH_TOKEN="optional-bearer"

# Apple FairPlay application certificate — REQUIRED for Apple approval.
NEXT_PUBLIC_CAPTURE_FAIRPLAY_CONFIGURED="true"
STORYTIME_FAIRPLAY_CERT_URL="https://.../fairplay.cer"   # or:
STORYTIME_FAIRPLAY_CERT_BASE64="<base64 of the .cer>"

# Signed playback (recommended with DRM so cleartext manifests are never served)
CLOUDFLARE_STREAM_SIGNED_URLS="true"
NEXT_PUBLIC_STREAM_SIGNED_URLS="true"
CLOUDFLARE_STREAM_SIGNING_KEY_ID="..."
CLOUDFLARE_STREAM_SIGNING_KEY_PEM="..."   # or _JWK
```

### How each system is delivered

- **Widevine & PlayReady** — `content-capture-protection/hls-drm.ts` configures
  hls.js EME (`com.widevine.alpha`, `com.microsoft.playready`) with `cbcs`,
  hardware-backed robustness, and the license proxy. Applied via `onHlsInstance`.
- **Apple FairPlay** — `content-capture-protection/fairplay.ts` attaches EME
  directly to the native `<video>` element (Safari never loads hls.js). It fetches
  the FPS certificate from `/api/content/drm-certificate`, sets the server
  certificate, generates the SPC on `encrypted`, posts it to
  `/api/content/drm-license`, and applies the returned CKC. Applied via
  `onProviderChange` when the native engine is selected.

### Getting the Apple FairPlay certificate

1. Request the FairPlay Streaming deployment package from Apple
   (developer.apple.com → Certificates → FairPlay Streaming).
2. Apple issues your **application certificate** (`.cer`) and the keys for your KSM
   (Key Security Module / license server).
3. Point `STORYTIME_DRM_LICENSE_URL` at your KSM's CKC endpoint and provide the
   certificate via the env vars above.
4. Use a managed DRM provider (e.g. Cloudflare Stream's DRM, EZDRM, BuyDRM,
   Axinom) for the KSM unless you operate your own.

> The app already proxies both the certificate and license requests through
> same-origin endpoints, which keeps CORS simple and lets you add auth/entitlement
> checks server-side — a requirement most studios/Apple expect.

---

## 5. Operational endpoints

| Endpoint                          | Purpose                                            |
| --------------------------------- | -------------------------------------------------- |
| `/api/upload/content-media/presign` | Mint presigned PUT for browser → storage upload  |
| `/api/upload/content-media/complete`| Finalize + queue Stream ingest (background)      |
| `/api/stream/webhook`             | Cloudflare → app status updates (HMAC verified)    |
| `/api/stream/reconcile`           | Cron + admin self-heal of pending assets           |
| `/api/content/[id]/playback-bundle` | Resolve playable source + metadata + DRM flags   |
| `/api/content/drm-license`        | Proxy SPC/license challenge → CKC/license          |
| `/api/content/drm-certificate`    | Serve the FairPlay application certificate          |

Verify configuration any time with:

```bash
npm run stream:verify     # Cloudflare + storage + DRM readiness checks
npm run health:platform   # broader platform health
```

---

## 6. Creator reliability checklist (so this never breaks again)

For the platform team / each new environment:

- [ ] `STORAGE_*` set **including** `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY`
      (presigned GET ingest needs credentials; without them, private uploads can't transcode).
- [ ] `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`,
      `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` set.
- [ ] `CLOUDFLARE_STREAM_WEBHOOK_SECRET` set and webhook registered
      (`npm run stream:verify` → `webhookRegistered: true`).
- [ ] `/api/stream/reconcile` cron active (configured in `vercel.json`, every 5 min)
      as the webhook backstop.
- [ ] For DRM/Apple approval: FairPlay cert + license server + signed URLs configured
      (section 4) and `stream:verify` shows `fairplayCertConfigured: true`.

For creators uploading content:

- Any common video container is accepted (MP4, MOV, WEBM, MKV, AVI, MPEG, M4V, HEVC…);
  Cloudflare transcodes to an adaptive ladder, so source codec/resolution is flexible.
- After upload, a title shows "Preparing your film…" until processing completes, then
  plays automatically. No re-upload or manual step is required.
- Trailers, episodes, and BTS clips all flow through the same pipeline and the same
  instant-start prefetching.
