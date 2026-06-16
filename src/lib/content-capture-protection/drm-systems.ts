import type { DrmSystemKey } from "./config";

/**
 * Client-facing DRM descriptor returned by the playback bundle. It only ever
 * references first-party proxy URLs (`/api/content/drm-license`) so that
 * upstream license-server secrets never reach the browser.
 */
export type PlaybackDrmDescriptor = {
  enabled: boolean;
  /** Which key systems the server is prepared to serve licences for. */
  systems: DrmSystemKey[];
  /** First-party proxy endpoints (per content/episode). */
  widevineLicenseUrl?: string;
  playreadyLicenseUrl?: string;
  fairplayLicenseUrl?: string;
  fairplayCertificateUrl?: string;
};

export const EME_KEY_SYSTEM_IDS: Record<DrmSystemKey, string> = {
  widevine: "com.widevine.alpha",
  playready: "com.microsoft.playready",
  fairplay: "com.apple.fps",
};

/** FairPlay legacy key-system id still required by some Safari versions. */
export const FAIRPLAY_LEGACY_KEY_SYSTEM = "com.apple.fps.1_0";

export type DrmCapability = {
  /** Preferred key system for this device, if DRM is required. */
  preferred: DrmSystemKey | null;
  /** All key systems worth attempting, most-preferred first. */
  candidates: DrmSystemKey[];
  /** Apple devices use native HLS + FairPlay rather than hls.js EME. */
  usesNativeFairplay: boolean;
};

type DeviceHints = {
  isApple: boolean;
  isEdge: boolean;
  isFirefox: boolean;
  isAndroid: boolean;
};

function detectDevice(): DeviceHints {
  if (typeof navigator === "undefined") {
    return { isApple: false, isEdge: false, isFirefox: false, isAndroid: false };
  }
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const isIPadOsDesktop = platform === "MacIntel" && maxTouchPoints > 1;
  const isApple =
    /iPad|iPhone|iPod/i.test(ua) ||
    isIPadOsDesktop ||
    (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua));
  const isEdge = /Edg\//i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  return { isApple, isEdge, isFirefox, isAndroid };
}

/**
 * Decide which DRM key system to attempt for the current device. Mirrors how
 * Netflix / Prime Video route requests: FairPlay on Apple, PlayReady on Edge,
 * Widevine everywhere else (Chrome, Firefox, Android, Samsung Internet).
 */
export function resolveDrmCapability(
  descriptor: PlaybackDrmDescriptor | null | undefined,
): DrmCapability {
  if (!descriptor?.enabled || descriptor.systems.length === 0) {
    return { preferred: null, candidates: [], usesNativeFairplay: false };
  }

  const available = new Set(descriptor.systems);
  const { isApple, isEdge, isFirefox } = detectDevice();

  const order: DrmSystemKey[] = [];
  const push = (key: DrmSystemKey) => {
    if (available.has(key) && !order.includes(key)) order.push(key);
  };

  if (isApple) {
    push("fairplay");
    push("widevine");
  } else if (isEdge) {
    push("playready");
    push("widevine");
  } else if (isFirefox) {
    push("widevine");
  } else {
    push("widevine");
    push("playready");
  }
  // Always allow remaining systems as a last resort.
  push("widevine");
  push("playready");
  push("fairplay");

  const preferred = order[0] ?? null;
  return {
    preferred,
    candidates: order,
    usesNativeFairplay: isApple && available.has("fairplay"),
  };
}
