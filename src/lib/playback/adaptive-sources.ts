import type { PlaybackDeviceProfile } from "@/lib/player/mobile-detect";
import type { PlaybackSource, PlaybackSourceSet } from "./types";

/** Pick the best adaptive source for the current device (Netflix/Prime-style ladder). */
export function selectPrimaryPlaybackSource(
  sources: PlaybackSourceSet,
  profile: PlaybackDeviceProfile,
): PlaybackSource {
  if (profile.family === "ios" || (profile.browser === "safari" && profile.isMobileLike)) {
    return sources.hls ?? sources.dash ?? sources.mp4 ?? sources.primary;
  }

  if (profile.family === "tv" || profile.isTvLike) {
    return sources.dash ?? sources.hls ?? sources.mp4 ?? sources.primary;
  }

  if (profile.browser === "edge" && sources.dash) {
    return sources.dash;
  }

  if (profile.family === "android" && sources.dash && profile.browser === "chrome") {
    return sources.dash;
  }

  return sources.hls ?? sources.dash ?? sources.mp4 ?? sources.primary;
}

export function buildPlaybackSourceSet(
  hls: PlaybackSource | null,
  dash: PlaybackSource | null,
  mp4: PlaybackSource | null,
): PlaybackSourceSet | null {
  const primary = hls ?? dash ?? mp4;
  if (!primary) return null;
  return { primary, hls, dash, mp4 };
}
