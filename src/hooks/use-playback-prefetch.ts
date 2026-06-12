"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchOnContentHover, preparePlaybackStart, parseEpisodeIdFromWatchHref } from "@/lib/prefetch";

export function useContentPrefetch() {
  const router = useRouter();

  return useCallback(
    (payload: {
      contentId: string;
      videoUrl?: string | null;
      trailerUrl?: string | null;
      posterUrl?: string | null;
    }) => {
      prefetchOnContentHover(payload, router);
    },
    [router],
  );
}

export function usePlaybackPrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(
    (options: {
      contentId: string;
      watchHref: string;
      videoUrl?: string | null;
      episodeId?: string | null;
    }) => {
      preparePlaybackStart({
        ...options,
        episodeId: options.episodeId ?? parseEpisodeIdFromWatchHref(options.watchHref),
        queryClient,
        router,
      });
    },
    [queryClient, router],
  );
}
