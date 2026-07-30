/**
 * Story Time platform bumper — plays before every feature title (not trailers).
 *
 * Primary delivery for apps: stitched into `/api/content/[id]/hls-manifest` as
 * demuxed fMP4 (video + audio) matching Cloudflare Stream, so one HLS URL plays
 * bumper → feature without an app update.
 *
 * Web also treats `stitchedIntoPlayback: true` and does not double-play the MP4.
 * MP4 `src` remains for rare non-HLS catalogue sources.
 */
export const PLATFORM_INTRO = {
  src: "/branding/storytime-platform-intro.mp4",
  mimeType: "video/mp4" as const,
  /** Bumper length (fMP4 video intro ≈ 4.0s; audio ≈ 4.05s). */
  durationSeconds: 4.0,
  skipAtSeconds: 4.0,
} as const;

export type PlatformIntroPayload = {
  /** When true, bumper is already inside `playback.src` HLS. */
  stitchedIntoPlayback: boolean;
  durationSeconds: number;
  skipAtSeconds: number;
  src?: string;
  type?: "video/mp4";
};

export function getPlatformIntroPayload(options?: {
  trailer?: boolean;
  /** True when playback goes through our HLS proxy (intro stitched server-side). */
  hlsProxied?: boolean;
}): PlatformIntroPayload | null {
  if (options?.trailer) return null;
  if (options?.hlsProxied) {
    return {
      stitchedIntoPlayback: true,
      durationSeconds: PLATFORM_INTRO.durationSeconds,
      skipAtSeconds: PLATFORM_INTRO.skipAtSeconds,
    };
  }
  return {
    stitchedIntoPlayback: false,
    durationSeconds: PLATFORM_INTRO.durationSeconds,
    skipAtSeconds: PLATFORM_INTRO.skipAtSeconds,
    src: PLATFORM_INTRO.src,
    type: PLATFORM_INTRO.mimeType,
  };
}
