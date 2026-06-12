import type { QueryClient } from "@tanstack/react-query";
import { warmPlaybackManifest } from "./engine";

export const PLAYBACK_BUNDLE_STALE_MS = 3 * 60 * 60 * 1000;

export function playbackBundleQueryKey(contentId: string, episodeId?: string | null) {
  return ["playback-bundle", contentId, episodeId ?? "main"] as const;
}

export async function fetchPlaybackBundle(contentId: string, episodeId?: string | null) {
  const qs = episodeId ? `?episodeId=${encodeURIComponent(episodeId)}` : "";
  const res = await fetch(`/api/content/${contentId}/playback-bundle${qs}`, {
    priority: "high",
  } as RequestInit);
  if (!res.ok) throw new Error("playback bundle unavailable");
  return res.json();
}

const warmedWatchRoutes = new Set<string>();
let playerModuleWarm = false;

export function preloadPlayerModule() {
  if (playerModuleWarm || typeof window === "undefined") return;
  playerModuleWarm = true;
  void import("@/components/player/storytime-media-player");
}

export function prefetchWatchRoute(
  watchHref: string,
  router?: { prefetch: (url: string) => void },
) {
  if (warmedWatchRoutes.has(watchHref) || !router) return;
  warmedWatchRoutes.add(watchHref);
  try {
    router.prefetch(watchHref);
  } catch {
    warmedWatchRoutes.delete(watchHref);
  }
}

export type PreparePlaybackOptions = {
  contentId: string;
  watchHref: string;
  videoUrl?: string | null;
  episodeId?: string | null;
  queryClient?: QueryClient;
  router?: { prefetch: (url: string) => void };
};

/** Warm route, player chunk, manifest, and playback bundle before navigation. */
export function preparePlaybackStart({
  contentId,
  watchHref,
  videoUrl,
  episodeId,
  queryClient,
  router,
}: PreparePlaybackOptions) {
  preloadPlayerModule();
  prefetchWatchRoute(watchHref, router);
  warmPlaybackManifest(videoUrl);

  if (queryClient) {
    void queryClient.prefetchQuery({
      queryKey: playbackBundleQueryKey(contentId, episodeId),
      queryFn: () => fetchPlaybackBundle(contentId, episodeId),
      staleTime: PLAYBACK_BUNDLE_STALE_MS,
    });
  } else {
    void fetchPlaybackBundle(contentId, episodeId).catch(() => {});
  }
}

export function parseEpisodeIdFromWatchHref(watchHref: string): string | null {
  try {
    const url = new URL(watchHref, "https://storytime.local");
    return url.searchParams.get("episode");
  } catch {
    return null;
  }
}
