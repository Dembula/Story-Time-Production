# Playback, Streaming & DRM Architecture

How Storytime ingests, converts, protects and plays film/series content — and
exactly what is required to reach studio/Apple-FairPlay-grade approval. The
design mirrors how Netflix and Prime Video structure playback: adaptive HLS/DASH
over a CDN, multi-DRM keyed per device, signed short-lived URLs, and aggressive
predictive warming so playback starts the instant the play button is pressed.

---

## 1. End-to-end content lifecycle

```
Creator upload (browser)
   │  presigned PUT
   ▼
S3 / R2 object storage  ──────────────►  public/source URL stored on the row
   │  (background, via next after())
   ▼
Cloudflare Stream ingest (copy from URL)         lib/content-media-post-upload.ts
   │   → transcodes to adaptive HLS (CMAF/fMP4) + DASH + MP4 + thumbnails
   ▼
StreamAsset row (uid, hlsUrl, dashUrl, status)   lib/stream-asset-store.ts
   │   Cloudflare webhook on "ready"             api/stream/webhook
   ▼
syncLinkedEntitiesAfterStreamReady()             lib/stream-entity-sync.ts
   │   → points Content.videoUrl / trailerUrl / episode.videoUrl at Stream
   ▼
Playback bundle  ───────────────────────────────►  Player
     api/content/[id]/playback-bundle               components/player/storytime-media-player.tsx
```

Key properties:

- **Upload never blocks on transcode.** The complete handler returns the S3 URL
  immediately and schedules Stream ingest in the background (`after()`), so the
  creator UI is instant.
- **Server-side source resolution.** `resolveServerPlaybackSourceSet()` prefers a
  ready Cloudflare Stream HLS/DASH manifest, signs it when signed URLs are on,
  and falls back to the raw source while transcoding is still in flight.
- **Self-healing URLs.** Even if a catalogue row still holds an S3 URL, the
  StreamAsset lookup upgrades it to adaptive Stream playback once ready.

---

## 2. Player (Netflix/Prime-style)

`StorytimeMediaPlayer` (Vidstack + hls.js) is the single playback surface for
features, episodes and trailers.

- **Adaptive HLS primary, DASH alternate.** HLS (CMAF/fMP4) is universal: native
  on Apple, hls.js everywhere else, and carries FairPlay/Widevine/PlayReady via
  EME. DASH is exposed as an alternate.
- **Instant start / predictive loading** (`lib/prefetch`):
  - On hover/intent: route prefetch, poster warm, **HLS manifest `<link rel=prefetch>` + low-priority fetch**, playback-bundle metadata, and the player JS chunk (`preloadPlayerModule`).
  - `load="eager"` + `preload="auto"` so the first segments are fetched before the user finishes the click.
  - Next-episode manifest + bundle are warmed during playback for seamless auto-advance.
- **Device-adaptive startup** (`lib/player/mobile-detect.ts`): desktop autoplays
  audibly; iOS/Android open native full-screen on the play gesture; TV/coarse
  pointers use the Netflix-style mobile controls; orientation lock on phones.
- **Resilience:** error boundary, signed-bundle wait state, graceful
  "video unavailable" fallback, and resume from `WatchProgress`.

---

## 3. DRM (the studio/Apple bar)

DRM is **off by default** (standard capture-protection mode). Switching
`CAPTURE_PROTECTION_MODE=drm` (server + client) activates multi-DRM.

### Key-system routing (per device, like the big platforms)

`resolveDrmCapability()` (`lib/content-capture-protection/drm-systems.ts`):

| Device / browser            | Key system            | Player path                       |
| --------------------------- | --------------------- | --------------------------------- |
| Safari / iOS / iPadOS / visionOS | **Apple FairPlay** | **Native EME** (`fairplay-native.ts`) |
| Edge / Windows              | **PlayReady** (→ Widevine) | hls.js EME (`hls-drm.ts`)    |
| Chrome / Android / Samsung  | **Widevine** (HW_SECURE_ALL) | hls.js EME                  |
| Firefox                     | **Widevine**          | hls.js EME                        |

> **Why native FairPlay matters:** Apple platforms play HLS *natively* and never
> run hls.js, so FairPlay must be wired through the standard `encrypted` EME
> event (with a legacy `webkitneedkey` fallback) directly on the `<video>`
> element. This is the path Apple validates — without it, "FairPlay support" is
> only nominal. It is implemented in `fairplay-native.ts` and attached in the
> player's `onProviderChange` (before the source loads, so no `encrypted` event
> is missed).

### License flow (secrets never reach the browser)

```
Browser EME challenge / SPC
   │  POST /api/content/drm-license?system=widevine&contentId=…
   ▼
First-party proxy (api/content/drm-license/route.ts)
   │  • authorises the viewer (subscription / PPV entitlement; trailers are open)
   │  • resolves the asset UID for {uid} templating
   │  • attaches STORYTIME_DRM_AUTH_TOKEN
   ▼
Upstream license server (Cloudflare Stream DRM / EZDRM / Axinom / PallyCon / BuyDRM)
   ▼
License / CKC  ──►  back to the browser EME session
```

- FairPlay also needs the DER **application certificate**, served via
  `GET /api/content/drm-license?system=fairplay&cert=1`.
- The DRM descriptor in the playback bundle only contains first-party proxy
  URLs, so upstream endpoints and tokens stay server-side.

### Robustness

- hls.js requests `HW_SECURE_ALL` (Widevine L1) / PlayReady SL3000, with a
  software fallback so playback still works on devices without hardware DRM.
- `cbcs` encryption scheme (CMAF) is used across all three systems.

---

## 4. Signed, expiring playback URLs

`CLOUDFLARE_STREAM_SIGNED_URLS=true` (+ `NEXT_PUBLIC_STREAM_SIGNED_URLS=true`)
switches the player to **require** signed manifests from the bundle — no
cleartext manifest is ever embedded. Tokens are RS256-signed locally
(`CLOUDFLARE_STREAM_SIGNING_KEY_*`) or fetched from the Stream token API, default
4h TTL, refreshed before expiry. Both HLS and DASH manifests are signed with one
token.

---

## 5. What is required for FairPlay / studio approval

The code is in place; these are **operational/credential** prerequisites:

1. **Cloudflare Stream DRM (or another DRM provider) enabled** for the account.
   Cloudflare Stream DRM is an enterprise feature — request access, or wire a
   provider such as EZDRM / Axinom / PallyCon / BuyDRM.
2. **Apple FairPlay deployment package** from Apple (the FPS SDK + your
   **application certificate** and the **Key Security Module** running on the
   license server). Put the DER certificate URL in
   `STORYTIME_DRM_FAIRPLAY_CERTIFICATE_URL` and the KSM/license endpoint in
   `STORYTIME_DRM_FAIRPLAY_LICENSE_URL`.
3. **Per-system license endpoints** set:
   `STORYTIME_DRM_WIDEVINE_LICENSE_URL`, `STORYTIME_DRM_PLAYREADY_LICENSE_URL`,
   `STORYTIME_DRM_FAIRPLAY_LICENSE_URL` (+ certificate). `{uid}` templating is
   supported for per-asset URLs.
4. **Encrypted manifests.** Content must be packaged/encrypted by the DRM
   provider (Cloudflare Stream does this when DRM is enabled on the account). DRM
   only engages when the manifest carries encryption init data.
5. **Signed URLs ON** in production (`CLOUDFLARE_STREAM_SIGNED_URLS=true`) plus a
   signing key, so manifests are short-lived and gated.
6. **Switch the platform into DRM mode:** `CAPTURE_PROTECTION_MODE=drm`,
   `NEXT_PUBLIC_CAPTURE_PROTECTION_MODE=drm`, `NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED=true`.
7. **HTTPS everywhere** (EME requires a secure context — already required for the
   app) and a registered Stream webhook (`scripts/verify-cloudflare-setup.ts`).

Once 1–7 are satisfied, the player automatically:
- serves FairPlay to Apple devices via native EME,
- serves Widevine/PlayReady elsewhere via hls.js EME,
- proxies every licence request through an authenticated first-party endpoint,
- and plays adaptive, signed, hardware-protected streams.

### Verifying

- `npm run stream:verify` — Cloudflare Stream config + webhook registration.
- `npm run health:platform` — broader platform readiness.
- Manual: load a DRM title on Safari (FairPlay), Chrome (Widevine) and Edge
  (PlayReady); confirm playback and that screen-capture records black on
  hardware-DRM devices.

---

## 6. Environment variables (summary)

See `.env.example` for the full list. DRM-relevant:

```
CAPTURE_PROTECTION_MODE=drm
NEXT_PUBLIC_CAPTURE_PROTECTION_MODE=drm
NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED=true
STORYTIME_DRM_WIDEVINE_LICENSE_URL=...
STORYTIME_DRM_PLAYREADY_LICENSE_URL=...
STORYTIME_DRM_FAIRPLAY_LICENSE_URL=...
STORYTIME_DRM_FAIRPLAY_CERTIFICATE_URL=...
STORYTIME_DRM_AUTH_TOKEN=...
CLOUDFLARE_STREAM_SIGNED_URLS=true
NEXT_PUBLIC_STREAM_SIGNED_URLS=true
CLOUDFLARE_STREAM_SIGNING_KEY_ID=...
CLOUDFLARE_STREAM_SIGNING_KEY_PEM=...   # or _JWK
```
