/**
 * Story Time platform bumper — plays before every feature title (not trailers).
 * Served as a static asset so web + any client that honors playback-bundle.platformIntro
 * can play the same clip. Duration is fixed from the authored asset (~4s).
 */
export const PLATFORM_INTRO = {
  /** Public URL path (Next.js `public/`). */
  src: "/branding/storytime-platform-intro.mp4",
  mimeType: "video/mp4" as const,
  durationSeconds: 4,
  /** Seek / end threshold for Skip intro. */
  skipAtSeconds: 4,
} as const;

export type PlatformIntroPayload = {
  src: string;
  type: "video/mp4";
  durationSeconds: number;
  skipAtSeconds: number;
};

export function getPlatformIntroPayload(options?: { trailer?: boolean }): PlatformIntroPayload | null {
  if (options?.trailer) return null;
  return {
    src: PLATFORM_INTRO.src,
    type: PLATFORM_INTRO.mimeType,
    durationSeconds: PLATFORM_INTRO.durationSeconds,
    skipAtSeconds: PLATFORM_INTRO.skipAtSeconds,
  };
}
