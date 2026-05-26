"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { prefetchOnContentHover } from "@/lib/prefetch";

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
