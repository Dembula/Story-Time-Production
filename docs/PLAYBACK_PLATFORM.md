# Playback Platform

Production architecture for the Storytime viewer: ingestion → encoding → adaptive
streaming → multi-DRM → instant playback across every device class. This document is
the source of truth for the end-to-end pipeline that lets a film play the moment a
viewer taps the play button — on iPhone, iPad, Apple TV, Android, Chromecast, Roku,
Smart TV, Xbox, PlayStation, Mac, Windows, and Linux.

## Goals

1. **Instant playback** — first frame paints within ~300ms of the play tap.
2. **Universal device support** — every major OS / browser / TV runs the same title.
3. **Adaptive quality** — ABR keeps the highest watchable bitrate without rebuffering.
4. **Studio-grade protection** — multi-DRM (FairPlay + Widevine + PlayReady) keeps
   the content protected to a level that satisfies Apple FairPlay, Google Widevine
   L1, and Microsoft PlayReady SL3000 review requirements.
5. **Operational visibility** — health endpoint surfaces every dependency at a glance.

## Layer map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Creator upload (S3 / R2)                                                    │
│   src/app/api/upload/content-media · src/lib/content-media-post-upload.ts   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ background ingest
┌────────────────────────────────────▼────────────────────────────────────────┐
│ Cloudflare Stream — HLS + DASH transcoding, captions, thumbnails            │
│   src/lib/cloudflare-stream.ts · src/app/api/stream/webhook                 │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ ready webhook
┌────────────────────────────────────▼────────────────────────────────────────┐
│ Catalogue — Content / ContentEpisode / StreamAsset                          │
│   prisma/schema.prisma · src/lib/stream-entity-sync.ts                      │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ playback request
┌────────────────────────────────────▼────────────────────────────────────────┐
│ Playback bundle API + per-system DRM proxy                                  │
│   src/app/api/content/[id]/playback-bundle                                  │
│   src/app/api/content/drm-license/[system]                                  │
│   src/app/api/content/drm-license/fairplay-cert                             │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ signed manifest + EME config
┌────────────────────────────────────▼────────────────────────────────────────┐
│ StorytimeMediaPlayer (Vidstack + hls.js + native HLS for Safari)            │
│   src/components/player/storytime-media-player.tsx                          │
│   src/lib/playback/client-drm.ts · src/lib/prefetch/engine.ts               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Ingestion pipeline

1. Creator uploads the master file via `/api/upload/content-media`. The route writes
   the original to S3/R2 and returns immediately with a `sourceUrl`.
2. `after()` triggers `ingestVideoStreamForContentMedia` in the background. It calls
   Cloudflare Stream `POST /accounts/<id>/stream/copy`, which transcodes into a
   multi-bitrate HLS ladder, a DASH manifest, captions, and thumbnails.
3. Cloudflare fires the `Webhook-Signature`-authenticated webhook to
   `/api/stream/webhook`. We persist the `StreamAsset` row and, when state = `ready`,
   `syncLinkedEntitiesAfterStreamReady` swaps the title's `videoUrl` from the raw S3
   URL over to the Cloudflare Stream HLS URL.

## Playback bundle (server)

`GET /api/content/[id]/playback-bundle` is the single source of truth the player
needs at start of session. It returns:

| Field | Purpose |
|-------|---------|
| `playback`   | Primary `{ src, type }` for the player (HLS preferred). |
| `playbackBundle.formats` | `{ hls, dash, mp4 }` — alternative deliveries for non-default platforms. |
| `playbackBundle.signed`  | True when manifest URL has an embedded JWT. |
| `playbackBundle.previews`| Poster + storyboard sprite for hover scrubbing. |
| `tracks`     | Subtitle tracks shaped for Vidstack `<Track>`. |
| `playbackProtection.drm` | Client hint listing DRM systems + proxy paths. |
| `captureProtection`      | Standard / DRM mode + watermark flags. |
| `enrichment` / `scenes`  | Scene jumps + metadata for the immersive panel. |
| `posterUrl` / `duration` | Display + resume metadata. |

The bundle is `Cache-Control: private, no-store` because manifest URLs and DRM
proxy hints are viewer-scoped.

## Multi-DRM

`src/lib/playback/drm.ts` resolves three independent DRM systems per title:

| System | Browsers / devices | Required env |
|--------|---------------------|--------------|
| **FairPlay (`com.apple.fps`)** | Safari (macOS, iOS, iPadOS), Apple TV | `STORYTIME_DRM_FAIRPLAY_LICENSE_URL`, `STORYTIME_DRM_FAIRPLAY_CERT_URL` |
| **Widevine (`com.widevine.alpha`)** | Chrome, Edge (Chromium), Brave, Android, Chromecast, Android TV | `STORYTIME_DRM_WIDEVINE_LICENSE_URL` |
| **PlayReady (`com.microsoft.playready`)** | Edge legacy, Xbox, some Smart TVs | `STORYTIME_DRM_PLAYREADY_LICENSE_URL` |

Resolution order per system:

1. Specific env (`STORYTIME_DRM_<SYSTEM>_LICENSE_URL`)
2. Legacy fallback (`STORYTIME_DRM_LICENSE_URL`)
3. Cloudflare Stream native DRM (when `CLOUDFLARE_STREAM_DRM_NATIVE=true` and a
   Cloudflare Stream UID is detected on the asset). Native URLs use the
   `https://videodelivery.net/<uid>/drm/<system>` shape.

The client never sees upstream license URLs. Instead it POSTs the EME challenge
to the per-system proxy under `/api/content/drm-license/[system]` (and GETs the
FairPlay cert at `/api/content/drm-license/fairplay-cert`). The proxy:

- Requires an authenticated session.
- Forwards the EME challenge with the right `Content-Type` per system
  (`application/octet-stream` for FairPlay/Widevine, `text/xml; charset=utf-8`
  for PlayReady) and the right `SOAPAction` for PlayReady.
- Adds the configured `STORYTIME_DRM_AUTH_TOKEN` bearer if the license server
  requires one.
- Tags the request with `X-Storytime-User` so the license server can enforce
  per-viewer policies (concurrent stream limit, output protection level, etc.).

## Client player (`StorytimeMediaPlayer`)

The player is Vidstack-on-hls.js for cross-browser MSE + native HLS on Safari.

Production tuning is centralized in `src/lib/playback/client-drm.ts`:

- **Buffer**: 30s ahead, 90s back-buffer, 60MB cap — comfortable for streaming
  films without ballooning memory on low-end devices.
- **ABR**: `capLevelToPlayerSize`, `startLevel: -1` (auto), aggressive retries on
  fragment timeouts so transient packet loss never strands the player.
- **EME**: `cbcs` encryption scheme on audio + video. Robustness is set to
  `HW_SECURE_DECODE` (Widevine) / `3000` (PlayReady) so screen-capture on macOS,
  Windows, and Android shows black while playback stays visible to the viewer.
- **FairPlay**: server cert is fetched through the proxy, license URL is wired
  through the EME challenge — both go through Storytime's authenticated proxy.

Subtitles in `tracks[]` are rendered as `<Track>` children of `<MediaPlayer>`, so
the default Vidstack caption menu picks them up automatically. The "default"
track is forced to exactly one entry so the player has a deterministic startup
choice.

## Instant playback (zero-spinner)

`src/lib/prefetch/engine.ts` warms three layers on hover:

1. Next.js route prefetch (detail + watch pages).
2. Poster `Image()` decode + `preconnect` to the media origin.
3. HLS master manifest fetch. After parsing the master, **the first variant
   manifest is also warmed** so hls.js opens the first segment without a second
   round-trip when the play tap finally lands.
4. The `/api/content/[id]/playback-bundle` JSON, including DRM hints, so EME is
   initialised before the user even reaches the watch route.

On click, `preparePlaybackStart` dynamically imports the player chunk, prefetches
the bundle through TanStack Query, and route-prefetches the watch URL. By the
time the watch page mounts, the manifest, the first segment, the DRM challenge,
and the JS chunk are all warm.

## Mobile fullscreen + autoplay

`src/lib/player/mobile-detect.ts` is the single source of truth for device
behaviour:

- **iOS / iPadOS** — uses the native AVPlayer fullscreen (`webkitEnterFullscreen`)
  so FairPlay engages and AirPlay / PiP work as expected.
- **Android** — falls back to the standard Fullscreen API, which honours
  Chromecast picker, downloads block, etc.
- **Desktop** — autoplay is permitted; player automatically requests fullscreen
  on first source paint.

For mobile gestures we expose `togglePlayPause`, `seekBack/Forward`, and
`toggleFullscreen` through a custom `PLAYBACK_COMMAND_EVENT` so platform input
adapters (remote control, gamepad) can issue the same commands.

## Capture protection

Two modes:

- **standard** (default) — `disableRemotePlayback`, `controlsList="nodownload
  noremoteplayback"`, context-menu + drag suppression, screen-capture detection
  via `MediaDevices.isScreenCaptured`. A polite overlay encourages viewers to
  stop capturing.
- **drm** — flips DRM EME on with hardware-backed robustness. On supported
  hardware (Apple T2 / Apple Silicon, Widevine L1 Android, PlayReady SL3000 PCs)
  the OS keeps decoded frames in a protected compositor path, so screen-capture
  output is black.

`CAPTURE_PROTECTION_MODE` (server) + `NEXT_PUBLIC_CAPTURE_PROTECTION_MODE`
(client) toggle this. `CAPTURE_WATERMARK_ENABLED` adds the forensic watermark
overlay for additional traceability.

## Operational diagnostics

`GET /api/playback/health` returns a structured snapshot:

```jsonc
{
  "stream": { "cloudflareConfigured": true, "signedPlaybackEnabled": true, … },
  "drm":    { "enabled": true, "systems": ["fairplay","widevine","playready"], … },
  "capture":{ "protectionEnabled": true, "watermarkEnabled": true }
}
```

Admins get an extended payload with `catalogue.titlesMissingVideo`,
`catalogue.titlesMissingTrailer`, and a `transcoding.last7Days` rollup by
`StreamAsset.status` so they can spot stuck encodes immediately.

## Environment summary

| Variable | Required for | Notes |
|----------|--------------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | Stream | |
| `CLOUDFLARE_STREAM_API_TOKEN` | Stream | Scope: Stream:Edit. |
| `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` | Stream | `https://customer-xxx.cloudflarestream.com` |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | Stream | HMAC for `Webhook-Signature`. |
| `CLOUDFLARE_STREAM_SIGNED_URLS` + `NEXT_PUBLIC_STREAM_SIGNED_URLS` | Signed playback | Enables JWT in the manifest URL. |
| `CLOUDFLARE_STREAM_SIGNING_KEY_ID` + `_PEM` or `_JWK` | Signed playback | Optional local signer; otherwise we hit `/stream/<uid>/token`. |
| `CAPTURE_PROTECTION_MODE=drm` | DRM | Required to engage EME. |
| `STORYTIME_DRM_FAIRPLAY_LICENSE_URL` + `_CERT_URL` | FairPlay | |
| `STORYTIME_DRM_WIDEVINE_LICENSE_URL` | Widevine | |
| `STORYTIME_DRM_PLAYREADY_LICENSE_URL` | PlayReady | |
| `STORYTIME_DRM_AUTH_TOKEN` | Optional | Forwarded as `Authorization: Bearer …` to upstream. |
| `CLOUDFLARE_STREAM_DRM_NATIVE=true` | Cloudflare Stream Enterprise DRM | Derives system URLs from UID. |

## Apple FairPlay submission checklist

To get an Apple FairPlay deployment package approved:

1. Set `CAPTURE_PROTECTION_MODE=drm` and configure
   `STORYTIME_DRM_FAIRPLAY_LICENSE_URL` + `STORYTIME_DRM_FAIRPLAY_CERT_URL`.
2. Enable signed playback (`CLOUDFLARE_STREAM_SIGNED_URLS=true`) so manifests
   cannot be replayed without an authenticated session.
3. Verify FairPlay challenges flow through `/api/content/drm-license/fairplay`
   and the cert through `/api/content/drm-license/fairplay-cert`.
4. Confirm `playsInline` + native fullscreen behaviour on iOS Safari (covered by
   `computePlaybackDeviceProfileClient` returning `prefersNativeFullscreen=true`).
5. Submit `GET /api/playback/health` output as evidence of the production
   pipeline configuration.

## Extending playback

- **New DRM system** — add a case in `resolveDrmEndpoints` + `buildClientDrmConfig`
  + per-system content-type in the proxy.
- **New delivery format** — extend `PlaybackSourceBundle.formats` and pick it in
  the client (`storytime-media-player`).
- **New device class** — extend `computePlaybackDeviceProfileClient` with the
  detection + the right `prefersNativeFullscreen` / autoplay defaults.
- **Subtitle authoring** — write to `ContentSubtitle` and they appear
  automatically in `tracks[]`.
