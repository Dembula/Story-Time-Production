/**
 * Story Time platform bumper — plays before every feature title (not trailers).
 *
 * Cloudflare Stream serves demuxed fMP4 HLS (separate AUDIO + #EXT-X-MAP). Stitching
 * our MPEG-TS bumper into that playlist makes film audio overlap the animation and
 * blacks out on mobile after discontinuity. So the bumper is delivered as a client
 * MP4 played before the clean feature HLS URL.
 */
export const PLATFORM_INTRO = {
  src: "/branding/storytime-platform-intro.mp4",
  mimeType: "video/mp4" as const,
  /** MP4 bumper length (~4.02s). Skip uses media `ended` preferentially. */
  durationSeconds: 4.02,
  skipAtSeconds: 4.02,
} as const;

export type PlatformIntroPayload = {
  /** Always false for Stream titles — bumper is never inside playback.src. */
  stitchedIntoPlayback: boolean;
  durationSeconds: number;
  skipAtSeconds: number;
  src?: string;
  type?: "video/mp4";
};

export function getPlatformIntroPayload(options?: {
  trailer?: boolean;
}): PlatformIntroPayload | null {
  if (options?.trailer) return null;
  return {
    stitchedIntoPlayback: false,
    durationSeconds: PLATFORM_INTRO.durationSeconds,
    skipAtSeconds: PLATFORM_INTRO.skipAtSeconds,
    src: PLATFORM_INTRO.src,
    type: PLATFORM_INTRO.mimeType,
  };
}
