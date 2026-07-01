import type { DailiesClipRecord } from "@/lib/dailies/types";
import { isDailiesStillMedia, resolveDailiesMediaType } from "@/lib/dailies/media";

/** Prefer Stream proxy/HLS for video; stills use the original image URL. */
export function resolveDailiesClipPlaybackUrl(
  clip: Pick<DailiesClipRecord, "proxyUrl" | "videoUrl" | "mediaType" | "metadata"> | null | undefined,
): string | null {
  if (!clip) return null;
  const mediaType = resolveDailiesMediaType(clip);
  if (isDailiesStillMedia(mediaType)) {
    return clip.videoUrl?.trim() || null;
  }
  return clip.proxyUrl?.trim() || clip.videoUrl?.trim() || null;
}
