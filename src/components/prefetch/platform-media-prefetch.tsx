"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  prefetchBrowseRoute,
  warmContentMetadata,
  warmMediaUrls,
  warmPlatformEntryAssets,
  warmThumbnail,
} from "@/lib/prefetch";

type CatalogItem = {
  id?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Idle-time warm-up for posters, backdrops, film metadata, and key routes
 * so moving between landing / browse / detail feels seamless.
 */
export function PlatformMediaPrefetch({
  items = [],
  entry = false,
  limit = 48,
}: {
  items?: CatalogItem[];
  /** Also warm landing spotlight + auth/browse entry routes. */
  entry?: boolean;
  limit?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (entry) {
      warmPlatformEntryAssets(router);
    }

    if (!items.length) return;

    warmMediaUrls(
      items.flatMap((item) => [item.posterUrl, item.backdropUrl]),
      limit,
    );

    const top = items.slice(0, 10);
    for (const item of top) {
      if (!item.id) continue;
      prefetchBrowseRoute(`/browse/content/${item.id}`, router);
      if (item.videoUrl) {
        prefetchBrowseRoute(`/browse/content/${item.id}/watch`, router);
      }
      void warmContentMetadata(item.id);
    }
  }, [entry, items, limit, router]);

  return null;
}

/** Warm upcoming browse hero backdrops so rotator transitions stay seamless. */
export function useWarmHeroBackdrops(
  urls: Array<string | null | undefined>,
  activeIndex: number,
) {
  useEffect(() => {
    if (!urls.length) return;
    const next = [
      urls[activeIndex],
      urls[(activeIndex + 1) % urls.length],
      urls[(activeIndex + 2) % urls.length],
    ];
    for (const url of next) warmThumbnail(url);
  }, [urls, activeIndex]);
}
