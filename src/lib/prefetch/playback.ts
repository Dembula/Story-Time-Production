import type { QueryClient } from "@tanstack/react-query";
import type { PlaybackSource } from "@/lib/playback-sources";
import {
  isStreamSignedPlaybackClientEnabled,
  SIGNED_PLAYBACK_STALE_MS,
} from "@/lib/stream-playback-protection";
import { warmPlaybackManifest } from "./engine";

export const PLAYBACK_BUNDLE_STALE_MS = 3 * 60 * 60 * 1000;

export type PlaybackBundleScene = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  summary: string | null;
  mood: string | null;
  actors: unknown;
};

export type PlaybackBundleSubtitle = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

export type PlaybackBundle = {
  id: string;
  title: string;
  playback: PlaybackSource | null;
  playbackProtection: {
    signedUrl: boolean;
    expiresHintSeconds: number;
    authenticatedViewer: boolean;
  };
  posterUrl: string | null;
  duration: number | null;
  enrichment: unknown | null;
  scenes: PlaybackBundleScene[];
  subtitles: PlaybackBundleSubtitle[];
  captureProtection: {
    enabled: boolean;
    mode: "standard" | "drm";
    watermarkEnabled: boolean;
    drmConfigured: boolean;
    drmLicensePath: string | null;
  };
};

export function playbackBundleQueryKey(
  contentId: string,
  episodeId?: string | null,
  options?: { trailer?: boolean },
) {
  return ["playback-bundle", contentId, episodeId ?? "main", options?.trailer ? "trailer" : "feature"] as const;
}

export async function fetchPlaybackBundle(
  contentId: string,
  episodeId?: string | null,
  options?: { trailer?: boolean },
): Promise<PlaybackBundle> {
  const params = new URLSearchParams();
  if (episodeId) params.set("episodeId", episodeId);
  if (options?.trailer) params.set("trailer", "1");
  const qs = params.toString() ? `?${params.toString()}` : "";
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
  trailer?: boolean;
  queryClient?: QueryClient;
  router?: { prefetch: (url: string) => void };
};

/** Warm route, player chunk, manifest, and playback bundle before navigation. */
export function preparePlaybackStart({
  contentId,
  watchHref,
  videoUrl,
  episodeId,
  trailer,
  queryClient,
  router,
}: PreparePlaybackOptions) {
  const signedPlaybackRequired = isStreamSignedPlaybackClientEnabled();
  preloadPlayerModule();
  prefetchWatchRoute(watchHref, router);
  if (!signedPlaybackRequired) {
    warmPlaybackManifest(videoUrl);
  }

  const loadBundle = () => {
    if (queryClient) {
      return queryClient.fetchQuery({
        queryKey: playbackBundleQueryKey(contentId, episodeId, { trailer }),
        queryFn: () => fetchPlaybackBundle(contentId, episodeId, { trailer }),
        staleTime: signedPlaybackRequired ? SIGNED_PLAYBACK_STALE_MS : PLAYBACK_BUNDLE_STALE_MS,
      });
    }

    return fetchPlaybackBundle(contentId, episodeId, { trailer });
  };

  void loadBundle()
    .then((bundle) => {
      const manifestUrl = bundle.playback?.src ?? (signedPlaybackRequired ? null : videoUrl ?? null);
      if (manifestUrl) warmPlaybackManifest(manifestUrl);
    })
    .catch(() => {});
}

export function parseEpisodeIdFromWatchHref(watchHref: string): string | null {
  try {
    const url = new URL(watchHref, "https://storytime.local");
    return url.searchParams.get("episode");
  } catch {
    return null;
  }
}
