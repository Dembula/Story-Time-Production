# Playback, DRM, and Device Compatibility Readiness

This document is the operating checklist for making Storytime playback reliable across browsers, mobile devices, TVs, and DRM ecosystems.

## Current platform baseline

- Uploads land in S3/R2-compatible storage through presigned uploads.
- Video assets are ingested into Cloudflare Stream for adaptive HLS delivery.
- The watch player uses Vidstack, which plays native HLS on Safari/iOS/tvOS and hls.js-backed HLS on Chromium/Firefox/Samsung-style browsers.
- `/api/content/[id]/playback-bundle` resolves the actual playable source, subtitles, scene metadata, signed URL state, and capture-protection flags.
- Signed Cloudflare Stream URLs are supported when `CLOUDFLARE_STREAM_SIGNED_URLS` and `NEXT_PUBLIC_STREAM_SIGNED_URLS` are enabled.
- Standard capture hardening is active in the player: no download controls, remote playback disabled, capture-handle registration where supported, and visible protected-playback status.
- Subtitles returned by the playback bundle are attached to the player as selectable text tracks.

## What this codebase can do without a DRM vendor

1. **Fast start / instant-feel playback**
   - Prefetch the watch route and player chunk.
   - Fetch the playback bundle before navigation.
   - Warm the final HLS manifest from the playback bundle, including signed manifests.
   - Eager-load the player once the watch view opens.

2. **Cross-browser web playback**
   - Prefer HLS for Stream assets.
   - Fall back to MP4/progressive playback only for non-HLS assets.
   - Use Vidstack for primary watch, error fallback, and BTS playback so Chrome/Firefox are not handed raw `.m3u8` URLs.

3. **Access control**
   - Gate full-title playback bundles behind subscriber entitlement, profile selection, PPV/subscription state, and profile age checks.
   - Gate DRM license proxy requests behind subscriber authentication.
   - Allow published trailers to use the same playback machinery without requiring a full subscription gate.

4. **Creator safety**
   - Admin approval already blocks titles whose Stream asset is not ready.
   - StreamAsset rows track ingest status and webhook results.

## What is still required for FairPlay, Widevine, and PlayReady approval

True studio-grade DRM cannot be completed only in the Next.js app. The platform still needs these external pieces:

1. **Encrypted packaging**
   - HLS with SAMPLE-AES/CBCS for Apple FairPlay.
   - DASH or HLS-CENC/CBCS profiles for Widevine and PlayReady depending on target devices.
   - Key IDs, content keys, rotation policy, and encryption metadata emitted into manifests.

2. **Multi-DRM license service**
   - FairPlay Streaming certificate, ASK, SPC/CKC exchange, and Apple-approved handling.
   - Widevine license issuance with L1/L3 policy choices.
   - PlayReady license issuance for Windows/Xbox/Edge and compatible smart TVs.
   - Per-title, per-user, per-device policy enforcement and renewal windows.

3. **Player DRM adapters**
   - FairPlay certificate loading and SPC/CKC request transforms for Safari/iOS/tvOS.
   - Widevine/PlayReady EME config for Chromium/Android/TV/Edge.
   - Provider-specific license headers and token exchange.

4. **CDN and manifest controls**
   - Signed manifests and signed segments.
   - Region/device policy enforcement.
   - Cache rules that do not leak licenses, manifests, or entitlement responses.

5. **Certification evidence**
   - Device matrix tests: iOS Safari, macOS Safari, Chrome/Edge/Firefox desktop, Android Chrome, Android TV, Samsung/LG browsers, Apple TV if native app exists.
   - DRM robustness verification: Widevine L1 where required, FairPlay on Apple hardware, PlayReady SL3000 where required.
   - Playback telemetry: startup time, rebuffer ratio, fatal error rate, license latency, CDN 4xx/5xx, dropped frames.

## Recommended provider path

Cloudflare Stream is sufficient for adaptive HLS web playback and signed URLs. If distributor/studio approval requires FairPlay/Widevine/PlayReady, add a multi-DRM packager/license provider such as BuyDRM, castLabs, EZDRM, Irdeto, Axinom, or a cloud media pipeline that can output encrypted HLS/DASH plus licenses.

The app should keep `/api/content/drm-license` as the authenticated proxy, but the provider-specific implementation must add:

- FairPlay certificate URL/config.
- License request body transforms for FairPlay SPC and CKC responses.
- Widevine/PlayReady request headers/tokens.
- Per-content authorization binding so a license request cannot be replayed for a different title.

## Operational readiness checklist

- `CLOUDFLARE_STREAM_SIGNED_URLS=true`
- `NEXT_PUBLIC_STREAM_SIGNED_URLS=true`
- `CAPTURE_PROTECTION_ENABLED=true`
- `NEXT_PUBLIC_CAPTURE_PROTECTION_ENABLED=true`
- `CAPTURE_PROTECTION_MODE=standard` until encrypted manifests are live.
- Switch to `CAPTURE_PROTECTION_MODE=drm` only after encrypted manifests and a real license service are verified.
- Monitor Stream webhook failures and queued assets older than the agreed SLA.
- Keep creator UI showing Stream status before publish approval.
- Run browser/device playback smoke tests after each player or upload-pipeline change.
