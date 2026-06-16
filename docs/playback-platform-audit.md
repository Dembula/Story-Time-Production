# Playback platform audit

This repository now has a stronger baseline for day-to-day playback reliability, but full studio-grade compatibility across Safari/FairPlay, Widevine, PlayReady, smart TVs, consoles, and offline-secure playback still depends on infrastructure that sits outside the web player alone.

## Implemented in this pass

- Server-side playback bundle generation is now shared and can be hydrated into the watch page before the client mounts.
- `/api/content/[id]/playback-bundle` now enforces authenticated subscriber access, viewer profile presence, entitlement checks, and age gating before returning playback URLs.
- Signed Cloudflare playback is treated as authoritative: when signed delivery is enabled, the server no longer falls back to clear S3 or unsigned playback URLs.
- The main watch player now:
  - hydrates from an already-resolved playback bundle for faster startup,
  - applies capture-protection hardening in the real watch path,
  - shows the protection badge for signed/secured streams,
  - loads WebVTT subtitle tracks and renders active captions in-player,
  - emits playback QoE events for startup, buffering, subtitle failures, playback errors, play, and completion.
- Browse-card trailer previews now prefer MP4 for Cloudflare-hosted assets, which avoids HLS preview failures on Chrome/Firefox.

## Still required for full platform readiness

### 1. Real multi-DRM packaging and licensing

The codebase contains DRM hooks and a license proxy, but approval-grade FairPlay/Widevine/PlayReady support requires:

- encrypted HLS/DASH manifests,
- CBCS/CENC packaging,
- per-title keys and rotation strategy,
- a production license service with entitlement enforcement,
- FairPlay certificate handling for Safari/iOS,
- renewal and device-security policy handling.

Without those pieces, the current DRM code is only a client-side shell.

### 2. Device-aware packaging strategy

A production service typically serves:

- HLS + FairPlay for Apple platforms,
- DASH + Widevine for Android/Chrome/Android TV,
- PlayReady-capable manifests for Microsoft/TV ecosystems,
- codec-aware ladders for AVC/HEVC/AV1 depending on device support.

Today the platform is effectively HLS-first. That is acceptable for many browsers, but not the same as full cross-platform streaming certification.

### 3. Upload and transcode maturity

For a Netflix/Prime-style media pipeline, the platform still needs:

- explicit ingest retry orchestration,
- status visibility for creators after upload,
- validated mezzanine/master requirements,
- subtitle upload/attachment workflows,
- alternate audio track ingestion,
- thumbnail/scrub track generation,
- policy-driven rendition ladders and codec profiles.

### 4. Delivery and observability

The app now emits client QoE events, but platform operations still need:

- dashboards/alerts for startup time, error rate, rebuffer ratio, and CDN failures,
- region/device segmentation,
- signed playback token audits,
- stream concurrency enforcement and abnormal-session detection,
- CDN/origin failover policy.

### 5. Offline and casting policy

Offline downloads and external playback require product decisions:

- DRM-backed offline licenses for protected titles,
- AirPlay/Chromecast policy by content-rights tier,
- remote playback allow/block rules by studio/distributor requirement.

The current offline path is not sufficient for protected-premium distribution.

## Recommended next infrastructure steps

1. Choose the long-term DRM/package stack:
   - Cloudflare Stream DRM if your account tier supports the needed workflows, or
   - a packager/license combination such as Shaka Packager + Axinom/EZDRM/Pallycon.
2. Add manifest selection by device capability and DRM support.
3. Add creator subtitle/audio upload flows and connect them to packaging.
4. Lock the upload origin so masters are not publicly readable once ingest completes.
5. Build a playback operations dashboard around the newly emitted QoE events.
