# Playback Platform Readiness

This document captures what is now handled in the application and what must still
be provided by streaming infrastructure before Story Time can pass a full
studio/DRM playback review across Apple FairPlay, Widevine, PlayReady, mobile,
desktop, and TV browsers.

## Current in-app playback stack

- Creator uploads use S3-compatible storage and are linked to Cloudflare Stream
  ingest.
- Approved titles are expected to play from Cloudflare HLS manifests through the
  main Vidstack player.
- `/api/content/[id]/playback-bundle` resolves the server-approved playback URL,
  subtitles, poster, scene metadata, signed URL state, and capture-protection
  settings.
- Feature playback bundles are gated by subscriber role, active subscription or
  PPV access, selected viewer profile, and profile age.
- Trailer playback bundles remain public promotional assets.
- The player preloads the route, player module, playback bundle, and final signed
  manifest where possible.
- The player attaches WebVTT subtitle tracks and hardens the underlying video
  element with the existing capture-protection hook.

## What is required outside app code

The app cannot make clear media into approved DRM media by itself. A production
review for Apple FairPlay, Google Widevine, and Microsoft PlayReady requires:

1. **Encrypted adaptive packaging**
   - HLS with CMAF/fMP4 segments for Apple platforms.
   - DASH or HLS+CMAF for Widevine/PlayReady targets, depending on the provider.
   - CENC/CBCS encryption compatible with the target DRM systems.
   - Multiple bitrate ladders and key rotation policies defined by the packager.
2. **Multi-DRM license service**
   - FairPlay Streaming certificate and license endpoint.
   - Widevine license endpoint.
   - PlayReady license endpoint.
   - Entitlement checks that validate the Story Time viewer/session before a
     license is issued.
3. **CDN and origin policy**
   - Signed playback URLs or tokenized manifests enabled for all protected films.
   - Short-lived tokens with cache headers that do not leak per-viewer URLs.
   - CORS policies for HLS/DASH manifests, segments, VTT captions, thumbnails,
     and license/certificate requests.
4. **Platform certification evidence**
   - Test matrix for Safari/iOS/tvOS, Chrome/Android, Edge/Windows, desktop
     Safari/Chrome/Firefox, and target smart-TV browsers.
   - Proof that FairPlay uses the production FPS certificate and approved key
     server.
   - Proof that Widevine/PlayReady licenses enforce the expected output
     protection and robustness levels, with documented fallbacks for L3 devices.

## Environment needed for protected playback

```env
CLOUDFLARE_STREAM_SIGNED_URLS="true"
NEXT_PUBLIC_STREAM_SIGNED_URLS="true"
CLOUDFLARE_STREAM_SIGNING_KEY_ID="..."
CLOUDFLARE_STREAM_SIGNING_KEY_JWK="..."

CAPTURE_PROTECTION_ENABLED="true"
NEXT_PUBLIC_CAPTURE_PROTECTION_ENABLED="true"
CAPTURE_PROTECTION_MODE="drm"
NEXT_PUBLIC_CAPTURE_PROTECTION_MODE="drm"
NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED="true"
STORYTIME_DRM_LICENSE_URL="https://drm.example.com/license"
STORYTIME_DRM_FAIRPLAY_CERT_URL="https://drm.example.com/fairplay.cer"
STORYTIME_DRM_AUTH_TOKEN="server-side-token-if-required"
```

## Upload and approval requirements for creators

- All creator video files should complete Stream ingest before admin approval.
- Admin approval should continue to block titles whose feature/trailer/episode
  assets have not reached a ready Stream state.
- Accepted source uploads should be mezzanine-quality files such as ProRes,
  high-bitrate H.264/H.265, or another provider-approved mezzanine format.
- The transcoder should emit an adaptive bitrate ladder rather than serving raw
  MP4 files for feature playback.
- Subtitles should be normalized to WebVTT and checked for CORS accessibility.

## Instant playback expectations

The app can make playback feel instant by warming the watch route, player bundle,
metadata bundle, media origin, and signed manifest before navigation. It still
cannot guarantee zero wait on every device because browsers control autoplay,
mobile user-gesture requirements, DRM license acquisition, network conditions,
and the first segment download. Production tuning should measure:

- time from Play click to route render,
- playback bundle response time,
- manifest response time,
- DRM license response time,
- first segment download time,
- first frame rendered,
- rebuffer count and startup failure rate by device profile.

## Known follow-up work

- Add a DASH/Shaka path if the chosen multi-DRM vendor recommends DASH for
  non-Apple TV/browser targets.
- Extend the playback bundle model to cover BTS clips and any future mini-player
  surfaces so secondary players do not bypass signed playback.
- Add automated browser playback smoke tests against a short encrypted fixture
  for Safari, Chrome, Edge, Android Chrome, and iOS Safari.
- Add operational alerts for Stream ingest failures, playback-bundle 4xx/5xx
  spikes, DRM license failures, and startup time regressions.
