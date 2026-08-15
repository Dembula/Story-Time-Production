"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  prefetchBrowseRoute,
  warmContentMetadata,
  warmMediaUrls,
  warmPlatformEntryAssets,
} from "@/lib/prefetch";

type CatalogItem = {
  id?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Idle-time warm-up for posters, backdrops, film metadata, and key routes.
 * Defers heavy catalogue warming so the browse hero can claim bandwidth first.
 */
export function PlatformMediaPrefetch({
  items = [],
  entry = false,
  limit = 48,
  /** Delay before warming the full catalogue (ms). Hero-first on browse. */
  deferMs = 0,
}: {
  items?: CatalogItem[];
  /** Also warm landing spotlight + auth/browse entry routes. */
  entry?: boolean;
  limit?: number;
  deferMs?: number;
}) {
  const router = useRouter();
  const itemKey = items
    .slice(0, limit)
    .map((item) => `${item.id ?? ""}:${item.posterUrl ?? ""}:${item.backdropUrl ?? ""}`)
    .join("|");

  useEffect(() => {
    if (entry) {
      warmPlatformEntryAssets(router);
    }

    if (!items.length) return;

    // Warm the first few hero/featured backdrops immediately for smooth rotator.
    const priority = items.slice(0, 5);
    warmMediaUrls(
      priority.flatMap((item) => [item.backdropUrl, item.posterUrl]),
      10,
    );
    for (const item of priority) {
      if (!item.id) continue;
      prefetchBrowseRoute(`/browse/content/${item.id}`, router);
    }

    const timer = window.setTimeout(() => {
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
    }, Math.max(0, deferMs));

    return () => window.clearTimeout(timer);
    // itemKey captures media identity without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable warm-up key
  }, [entry, itemKey, limit, deferMs, router]);

  return null;
}
