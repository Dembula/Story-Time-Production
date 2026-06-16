import type { PlaybackSource } from "@/lib/playback-sources";
import { resolvePlaybackBundle } from "@/lib/playback/source-bundle";

/**
 * Back-compat shim. Server-side code that still needs the single primary playback
 * source should call this; new callers should use `resolvePlaybackBundle` instead.
 */
export async function resolveServerPlaybackSource(
  videoUrl: string | null | undefined,
): Promise<PlaybackSource | null> {
  const bundle = await resolvePlaybackBundle(videoUrl);
  return bundle?.primary ?? null;
}
