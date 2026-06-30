import type { DailiesClipRecord } from "@/lib/dailies/types";

/** Prefer Stream proxy/HLS, then original bucket URL. */
export function resolveDailiesClipPlaybackUrl(
  clip: Pick<DailiesClipRecord, "proxyUrl" | "videoUrl"> | null | undefined,
): string | null {
  if (!clip) return null;
  return clip.proxyUrl?.trim() || clip.videoUrl?.trim() || null;
}
