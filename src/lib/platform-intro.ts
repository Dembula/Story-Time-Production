/**
 * Story Time platform bumper — plays before every feature title (not trailers).
 *
 * Primary delivery: stitched into `/api/content/[id]/hls-manifest` (AAC 48 kHz
 * to match Cloudflare Stream) so one HLS URL plays bumper → feature without a
 * second autoplay gesture (critical on iOS/Android).
 * MP4 fallback remains for non-HLS catalogue sources.
 */
export const PLATFORM_INTRO = {
  /** Progressive MP4 fallback (client-sequenced only when HLS stitch is unavailable). */
  src: "/branding/storytime-platform-intro.mp4",
  mimeType: "video/mp4" as const,
  /**
   * Bumper length in seconds (sum of intro HLS #EXTINF ≈ 4.08).
   * Used for Skip intro seek and content-time offset on stitched timelines.
   */
  durationSeconds: 4.08,
  skipAtSeconds: 4.08,
} as const;

export type PlatformIntroPayload = {
  /** When true, bumper is already inside `playback.src` HLS — do not play a second intro. */
  stitchedIntoPlayback: boolean;
  durationSeconds: number;
  skipAtSeconds: number;
  /** Present only when the client must play the bumper separately (non-HLS fallback). */
  src?: string;
  type?: "video/mp4";
};

export function getPlatformIntroPayload(options?: {
  trailer?: boolean;
  /** True when the feature will play via our HLS proxy (intro is stitched server-side). */
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
