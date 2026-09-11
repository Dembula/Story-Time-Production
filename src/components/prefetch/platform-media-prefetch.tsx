"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  prefetchBrowseRoute,
  warmContentMetadata,
  warmMediaUrls,
  warmPlatformEntryAssets,
} from "@/lib/prefetch";
import { computeIsMobileLikeClient } from "@/lib/player/mobile-detect";

type CatalogItem = {
  id?: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
};

/**
 * Idle-time warm-up for posters, backdrops, film metadata, and key routes.
 * Defers heavy catalogue warming so the browse hero can claim bandwidth first.
 * On mobile/iOS this is heavily capped to avoid Safari Web Content OOM crashes.
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
    const mobile = computeIsMobileLikeClient();
    const warmLimit = mobile ? Math.min(limit, 6) : limit;
    const warmDefer = mobile ? Math.max(deferMs, 4500) : deferMs;

    if (entry) {
      // Landing entry warm of 24 posters + intro video is a common iOS crash trigger.
      if (!mobile) {
        warmPlatformEntryAssets(router);
      } else {
        prefetchBrowseRoute("/browse", router);
        prefetchBrowseRoute("/auth/signin", router);
        prefetchBrowseRoute("/auth/signup", router);
      }
    }

    if (!items.length) return;

    const priority = items.slice(0, mobile ? 2 : 5);
    warmMediaUrls(
      priority.flatMap((item) => [item.backdropUrl, item.posterUrl]),
      mobile ? 4 : 10,
    );
    for (const item of priority) {
      if (!item.id) continue;
      prefetchBrowseRoute(`/browse/content/${item.id}`, router);
    }

    const timer = window.setTimeout(() => {
      warmMediaUrls(
        items.flatMap((item) => [item.posterUrl, item.backdropUrl]),
        warmLimit,
      );

      const top = items.slice(0, mobile ? 4 : 10);
      for (const item of top) {
        if (!item.id) continue;
        prefetchBrowseRoute(`/browse/content/${item.id}`, router);
        if (!mobile && item.videoUrl) {
          prefetchBrowseRoute(`/browse/content/${item.id}/watch`, router);
        }
        if (!mobile) {
          void warmContentMetadata(item.id);
        }
      }
    }, Math.max(0, warmDefer));

    return () => window.clearTimeout(timer);
    // itemKey captures media identity without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable warm-up key
  }, [entry, itemKey, limit, deferMs, router]);

  return null;
}
