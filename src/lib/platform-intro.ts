/**
 * Story Time platform bumper — Netflix-style: one continuous HLS timeline.
 *
 * Delivery: stitched into `/api/content/[id]/hls-manifest` (demuxed fMP4 for
 * Cloudflare Stream). Web, mobile apps, and TV all play the same `playback.src`.
 * There is no separate client-side intro player for HLS titles.
 */
export const PLATFORM_INTRO = {
  /** Static MP4 kept for rare non-HLS catalogue fallbacks only. */
  src: "/branding/storytime-platform-intro.mp4",
  mimeType: "video/mp4" as const,
  /** Matches fMP4 video intro sum (2s + 2s). */
  durationSeconds: 4.0,
  skipAtSeconds: 4.0,
} as const;

/** Public paths to prefetch so the bumper does not stall on slow networks. */
export const PLATFORM_INTRO_PREFETCH_PATHS = [
  "/branding/intro/fmp4/init_v.mp4",
  "/branding/intro/fmp4/init_a.mp4",
  "/branding/intro/fmp4/v_000.m4s",
  "/branding/intro/fmp4/v_001.m4s",
  "/branding/intro/fmp4/a_000.m4s",
  "/branding/intro/fmp4/a_001.m4s",
  "/branding/intro/fmp4/a_002.m4s",
] as const;

export type PlatformIntroPayload = {
  /** Bumper is inside `playback.src` — skip seeks within the same player. */
  stitchedIntoPlayback: true;
  durationSeconds: number;
  skipAtSeconds: number;
};

export function getPlatformIntroPayload(options?: {
  trailer?: boolean;
  /** True when playback goes through our HLS proxy (intro stitched server-side). */
  hlsProxied?: boolean;
}): PlatformIntroPayload | null {
  if (options?.trailer) return null;
  if (!options?.hlsProxied) {
    // Non-HLS titles: still advertise timing metadata; player may play MP4 via
    // the same chrome only if we add that path later. Prefer ingest to Stream.
    return null;
  }
  return {
    stitchedIntoPlayback: true,
    durationSeconds: PLATFORM_INTRO.durationSeconds,
    skipAtSeconds: PLATFORM_INTRO.skipAtSeconds,
  };
}
