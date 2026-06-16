import type { PlaybackDeviceProfile } from "@/lib/player/mobile-detect";

export type DrmKeySystem =
  | "com.widevine.alpha"
  | "com.microsoft.playready"
  | "com.apple.fps";

/** Ordered DRM key systems for the current device (highest priority first). */
export function getPreferredDrmKeySystems(profile: PlaybackDeviceProfile): DrmKeySystem[] {
  if (profile.family === "ios" || profile.browser === "safari") {
    return ["com.apple.fps", "com.widevine.alpha", "com.microsoft.playready"];
  }

  if (profile.browser === "edge") {
    return ["com.microsoft.playready", "com.widevine.alpha", "com.apple.fps"];
  }

  if (profile.family === "tv") {
    return ["com.widevine.alpha", "com.microsoft.playready", "com.apple.fps"];
  }

  return ["com.widevine.alpha", "com.microsoft.playready", "com.apple.fps"];
}
