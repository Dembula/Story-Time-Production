# Playback platform readiness

## What this sweep fixes now

This playback hardening pass closes the most immediate reliability and security gaps in the current web stack:

- **Playback-bundle access now matches watch-page entitlement rules.**
  - Stream URLs can no longer be fetched from the playback API without the same subscriber/profile checks used by the watch page.
- **Trailer playback is separated from subscriber-only feature playback.**
  - Public trailer starts can work without unlocking the full title.
- **Signed playback prefetch now warms the real entitled manifest.**
  - The preload path no longer fetches the wrong unsigned manifest before navigation.
- **Main-player subtitles are now wired in.**
  - Existing VTT subtitle records are now passed into the Vidstack player.
- **Offline handoff is completed for downloaded feature titles on web.**
  - The watch flow can now switch to the locally cached blob URL instead of always requesting the network source.
- **Protected playback no longer falls back to raw origin URLs on runtime error.**
  - Signed/protected playback stays protected.
- **Capture-protection status is now surfaced in the live player UI.**
  - This makes the current protection mode visible during playback.

## What the platform already is

Today the platform is a **web-first streaming service** built around:

1. Creator upload to S3-compatible storage.
2. Cloudflare Stream ingest/transcode.
3. HLS playback through Vidstack in a Next.js app.
4. Signed playback URLs for web delivery hardening.

That is a valid web streaming architecture, but it is **not yet a full multi-DRM / all-device OTT platform**.

## What is still missing for true Netflix / Prime style compatibility

### 1. Multi-DRM packaging and license delivery

The current delivery backbone is **Cloudflare Stream + signed HLS URLs**. That is not enough for full premium-device coverage.

To support **Widevine + FairPlay + PlayReady** properly, the platform still needs:

- **Encrypted packaging** using CMAF/Common Encryption.
- **License services** for:
  - Widevine
  - FairPlay
  - PlayReady
- **FairPlay certificate and KSM flow** for Apple platforms.
- **Per-device DRM policy enforcement** for HD/4K, concurrency, rental windows, offline rights, and output protection.

### 2. A platform that actually supports multi-DRM end to end

If the business requires broad studio-grade playback approval, the platform should either:

- move premium playback to a provider that supports **multi-DRM out of the box**, or
- add a dedicated **packager + multi-DRM provider** in front of the current catalog and entitlement system.

Recommended target capabilities:

- HLS + DASH manifests
- CMAF segments
- FairPlay / Widevine / PlayReady license endpoints
- tokenized entitlement
- secure key management in KMS/HSM-backed infrastructure
- playback analytics and error telemetry

### 3. Native playback clients for full device coverage

This repository currently delivers playback through the web app only.

To truly cover **all major platforms/devices**, the platform still needs native apps or TV apps for:

- **iOS / iPadOS** using AVPlayer + FairPlay
- **tvOS** using AVPlayer + FairPlay
- **Android** using ExoPlayer + Widevine
- **Android TV / Fire TV**
- **Samsung Tizen**
- **LG webOS**
- optionally **Roku / Xbox / PlayStation**

Web playback alone can be very good, but it is not enough for "works everywhere" approval at the same level as large OTT services.

### 4. True offline playback architecture

The current patch completes the **web download handoff**, but that is not the same as studio-grade offline viewing.

For robust offline playback, the platform still needs:

- DRM-aware offline licenses
- segmented offline packaging
- manifest/key persistence
- resume/retry logic per rendition
- native app storage controls
- device-bound offline entitlement revocation

### 5. Full quality-of-experience and startup optimization

To get closer to Netflix/Prime style instant starts and stable watch sessions, the next layer should add:

- **startup bitrate tuning** and player heuristics per device/network
- **QoE analytics** for join time, rebuffers, fatal errors, bitrate shifts, exits
- **manifest/segment CDN observability**
- **origin failover / redundancy**
- **precomputed trailers / posters / storyboards**
- **background token refresh** for very long watch sessions
- **adaptive audio/subtitle track management**

### 6. Ingest and catalog pipeline hardening

For future creators so the issue does not keep recurring, the ingest pipeline should enforce:

- source-file validation before publish
- mezzanine/master asset retention
- explicit transcode readiness state
- packaging readiness state
- subtitle validation
- poster/thumb validation
- webhook retry visibility
- automated media QC reports
- admin visibility into ingest failures and stream readiness

## Recommended target architecture

For premium film playback across browsers, Apple devices, Android, TVs, and future native apps, the target shape should be:

1. **Upload / ingest**
   - creators upload a mezzanine master
   - run validation/QC

2. **Encoding / packaging**
   - generate ABR ladder
   - package once into CMAF-compatible assets
   - emit HLS + DASH manifests

3. **DRM**
   - encrypt once
   - deliver FairPlay / Widevine / PlayReady licenses by device

4. **Entitlement service**
   - issue short-lived playback tokens
   - enforce subscription, PPV, device count, geography, age/profile rules

5. **Playback clients**
   - web player
   - iOS/tvOS player
   - Android/Android TV player
   - smart-TV players

6. **Observability**
   - startup time
   - buffering rate
   - error rate
   - license latency
   - CDN/origin health

## Immediate next steps after this patch

1. **Decide whether premium titles stay on Cloudflare Stream or move to a multi-DRM-capable video platform.**
2. **Introduce a real packaging/DRM layer** before promising FairPlay/Widevine/PlayReady support.
3. **Add playback telemetry** so startup delay and buffering can be measured per device.
4. **Enforce device-count/concurrency rules** at playback token issuance time.
5. **Build native Apple and Android playback surfaces** if the goal is genuine all-device compatibility.

## Bottom line

After this patch, the current web player path is more secure, more consistent, and more reliable.

However, **full Apple FairPlay / Widevine / PlayReady / all-device compatibility is not just a player tweak**. It requires:

- a DRM-capable packaging and license stack,
- native clients for major device families,
- entitlement-aware token/license services,
- and playback observability across the whole media pipeline.
