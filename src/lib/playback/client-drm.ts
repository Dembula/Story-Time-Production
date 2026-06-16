"use client";

import type {
  DrmKeySystemId,
  PlaybackContainerKind,
  PlaybackDrmDescriptor,
  PlaybackManifest,
  PlaybackSourceDescriptor,
} from "./manifest-types";

/**
 * Capability matrix detection. Mirrors what Netflix / Prime do:
 *   - Apple Safari / iOS / iPadOS / macOS / tvOS  → FairPlay (CBCS / HLS)
 *   - Chrome (desktop, Android), Edge (Chromium), Firefox, Samsung Internet
 *       → Widevine (CENC or CBCS depending on container)
 *   - Edge legacy, Xbox, classic Windows apps
 *       → PlayReady
 *   - Fallback: ClearKey for unencrypted dev/local streams
 */
export type DeviceDrmCapabilities = {
  fairPlay: boolean;
  widevine: boolean;
  playReady: boolean;
  clearKey: boolean;
  /** True when the browser handles HLS natively (Safari, iOS). */
  nativeHls: boolean;
  /** True when the browser can decode CMAF/MSE (most non-Safari browsers). */
  mse: boolean;
};

const DRM_PRIORITY: DrmKeySystemId[] = [
  "com.apple.fps",
  "com.apple.fps.1_0",
  "com.apple.fps.2_0",
  "com.widevine.alpha",
  "com.microsoft.playready.recommendation",
  "com.microsoft.playready",
  "org.w3.clearkey",
];

const SAFARI_HLS_MIME = "application/vnd.apple.mpegurl";

export function detectDeviceDrmCapabilities(): DeviceDrmCapabilities {
  if (typeof window === "undefined") {
    return {
      fairPlay: false,
      widevine: false,
      playReady: false,
      clearKey: false,
      nativeHls: false,
      mse: false,
    };
  }

  const ua = navigator.userAgent || "";
  const isAppleHost = /iPad|iPhone|iPod|Macintosh|AppleTV/i.test(ua);
  const video = document.createElement("video");
  const nativeHls =
    typeof video.canPlayType === "function" &&
    Boolean(video.canPlayType(SAFARI_HLS_MIME)) &&
    isAppleHost;

  const mse =
    typeof window.MediaSource !== "undefined" &&
    typeof window.MediaSource.isTypeSupported === "function";

  // FairPlay needs the legacy WebKitMediaKeys constructor (Apple platforms).
  const fairPlay =
    nativeHls &&
    typeof (window as unknown as { WebKitMediaKeys?: unknown }).WebKitMediaKeys !==
      "undefined";

  // For Widevine / PlayReady / ClearKey we only feature-detect at request
  // time (requestMediaKeySystemAccess is async). We default-allow non-Apple
  // platforms here and let `pickSupportedSource` filter at use site.
  const widevine = !isAppleHost || mse;
  const playReady =
    typeof navigator !== "undefined" &&
    /Edg\/|Xbox|Windows NT/i.test(ua) &&
    !isAppleHost;
  const clearKey = mse;

  return { fairPlay, widevine, playReady, clearKey, nativeHls, mse };
}

/**
 * Pick the best source from a `PlaybackManifest` for the current device.
 * Apple devices prefer FairPlay HLS; everything else prefers Widevine DASH.
 * Clear sources (no DRM) are always allowed as a final fallback.
 */
export function pickSupportedSource(
  manifest: PlaybackManifest,
  caps: DeviceDrmCapabilities = detectDeviceDrmCapabilities(),
): PlaybackSourceDescriptor | null {
  const isAppleLike = caps.nativeHls || caps.fairPlay;

  const ordered = manifest.sources.slice().sort((a, b) => {
    const score = (s: PlaybackSourceDescriptor) => {
      const isFairPlay = s.drm?.keySystem.startsWith("com.apple.fps");
      const isWidevine = s.drm?.keySystem === "com.widevine.alpha";
      const isPlayReady = s.drm?.keySystem.startsWith("com.microsoft.playready");
      const isClear = !s.drm;

      if (isAppleLike) {
        if (s.container === "hls" && isFairPlay) return 0;
        if (s.container === "hls" && isClear) return 1;
        if (s.container === "mp4") return 5;
        if (s.container === "dash") return 8;
      } else {
        if (s.container === "dash" && isWidevine && caps.widevine) return 0;
        if (s.container === "dash" && isPlayReady && caps.playReady) return 1;
        if (s.container === "hls" && (isClear || (isWidevine && caps.widevine))) return 2;
        if (s.container === "mp4") return 4;
        if (s.container === "dash" && isClear) return 6;
      }
      return 10 + s.priority;
    };
    return score(a) - score(b);
  });

  return ordered[0] ?? null;
}

export type FairPlayKeyHandler = {
  attach: (video: HTMLVideoElement) => () => void;
};

/**
 * Build a FairPlay key-system handler bound to a `PlaybackDrmDescriptor`.
 *
 * Apple's FairPlay flow (native HLS) uses `webkitneedkey`/`webkitkeymessage`:
 *   1. Browser fires `webkitneedkey` with initData (the "skd://" content id).
 *   2. We fetch the application certificate.
 *   3. We instantiate a WebKitMediaKeys/Session and pass the initData.
 *   4. The session fires `webkitkeymessage` with the SPC payload.
 *   5. We POST the SPC + content id to the license server.
 *   6. Server returns CKC, we hand it back via `session.update(ckc)`.
 */
export function createFairPlayKeyHandler(
  drm: PlaybackDrmDescriptor,
): FairPlayKeyHandler {
  return {
    attach(video: HTMLVideoElement) {
      const w = window as unknown as {
        WebKitMediaKeys?: {
          new (keySystem: string): {
            createSession: (
              type: string,
              initData: Uint8Array,
            ) => {
              addEventListener: (
                event: string,
                handler: (ev: Event & { message?: Uint8Array }) => void,
              ) => void;
              update: (ckc: Uint8Array) => void;
            };
          };
        };
      };

      if (!w.WebKitMediaKeys || !drm.certificateUrl || !drm.licenseUrl) {
        return () => undefined;
      }

      const certCache: { value: Uint8Array | null } = { value: null };
      let cancelled = false;

      const fetchCertificate = async (): Promise<Uint8Array> => {
        if (certCache.value) return certCache.value;
        const res = await fetch(drm.certificateUrl!, {
          credentials: "include",
          headers: drm.certificateRequestHeaders,
        });
        if (!res.ok) throw new Error("FairPlay certificate fetch failed");
        const buf = new Uint8Array(await res.arrayBuffer());
        certCache.value = buf;
        return buf;
      };

      const onNeedKey = async (event: Event) => {
        try {
          const ev = event as unknown as { initData?: Uint8Array; target?: HTMLVideoElement };
          if (!ev.initData) return;
          await fetchCertificate();

          const videoEl = ev.target ?? video;
          const target = videoEl as unknown as {
            webkitKeys?: unknown;
            webkitSetMediaKeys?: (keys: unknown) => void;
          };

          const keys = new w.WebKitMediaKeys!("com.apple.fps.1_0");
          if (!target.webkitKeys) {
            target.webkitSetMediaKeys?.(keys);
          }

          const session = keys.createSession("video/mp4", ev.initData);
          session.addEventListener("webkitkeymessage", async (msg) => {
            if (cancelled) return;
            const message = msg.message;
            if (!message) return;
            try {
              const res = await fetch(drm.licenseUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                  ...drm.licenseRequestHeaders,
                  "Content-Type": "application/octet-stream",
                },
                body: message as unknown as BodyInit,
              });
              if (!res.ok) throw new Error(`FairPlay license: ${res.status}`);
              const ckc = new Uint8Array(await res.arrayBuffer());
              session.update(ckc);
            } catch (err) {
              console.error("FairPlay key message handler failed:", err);
            }
          });
        } catch (err) {
          console.error("FairPlay needKey handler failed:", err);
        }
      };

      const videoLike = video as unknown as {
        addEventListener: (event: string, handler: EventListener) => void;
        removeEventListener: (event: string, handler: EventListener) => void;
      };

      videoLike.addEventListener("webkitneedkey", onNeedKey as EventListener);

      return () => {
        cancelled = true;
        videoLike.removeEventListener("webkitneedkey", onNeedKey as EventListener);
      };
    },
  };
}

/**
 * Build hls.js DRM config for Widevine / PlayReady via EME.
 * Used when the player runs hls.js (non-Apple browsers).
 */
export function buildHlsDrmConfigForSource(
  source: PlaybackSourceDescriptor,
): Record<string, unknown> | null {
  const drm = source.drm;
  if (!drm) return null;
  if (drm.keySystem.startsWith("com.apple.fps")) return null;

  return {
    emeEnabled: true,
    drmSystemOptions: {
      audioEncryptionScheme: drm.encryptionScheme ?? "cenc",
      videoEncryptionScheme: drm.encryptionScheme ?? "cenc",
    },
    drmSystems: {
      [drm.keySystem]: {
        licenseUrl: drm.licenseUrl,
        videoRobustness: drm.videoRobustness,
        audioRobustness: drm.audioRobustness,
      },
    },
    licenseXhrSetup: (xhr: XMLHttpRequest) => {
      const headers = drm.licenseRequestHeaders ?? {};
      for (const [name, value] of Object.entries(headers)) {
        try {
          xhr.setRequestHeader(name, value);
        } catch {
          // ignore — some browsers block restricted header names.
        }
      }
      xhr.withCredentials = true;
    },
  };
}

/** Build a dash.js / shaka-player request filter for Widevine/PlayReady. */
export function buildDashDrmConfigForSource(
  source: PlaybackSourceDescriptor,
): {
  protData: Record<string, unknown>;
  applyRequestModifier: (modifier: (request: XMLHttpRequest) => void) => void;
} | null {
  const drm = source.drm;
  if (!drm) return null;
  if (drm.keySystem.startsWith("com.apple.fps")) return null;

  const protData: Record<string, unknown> = {
    [drm.keySystem]: {
      serverURL: drm.licenseUrl,
      httpRequestHeaders: drm.licenseRequestHeaders ?? {},
      withCredentials: true,
      videoRobustness: drm.videoRobustness,
      audioRobustness: drm.audioRobustness,
      sessionType: drm.persistentState === "required" ? "persistent-license" : "temporary",
    },
  };
  return {
    protData,
    applyRequestModifier: (modifier) => {
      // Reserved hook for future shaka/dash request signing — kept here so
      // call sites are stable while we evaluate which engine ships.
      void modifier;
    },
  };
}

export const ALL_KEY_SYSTEMS: DrmKeySystemId[] = DRM_PRIORITY;

export function summariseManifestForDiagnostics(
  manifest: PlaybackManifest,
): { container: PlaybackContainerKind; keySystem: DrmKeySystemId | "clear" }[] {
  return manifest.sources.map((s) => ({
    container: s.container,
    keySystem: s.drm?.keySystem ?? "clear",
  }));
}
