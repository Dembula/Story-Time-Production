"use client";

import type { LandingSpotlightItem } from "@/lib/landing-spotlight";

type SpotlightResponse = { items?: LandingSpotlightItem[] };

let inflight: Promise<LandingSpotlightItem[]> | null = null;
let cached: LandingSpotlightItem[] | null = null;

/** Shared client fetch so backdrop + Top 10 do not stampede the same API. */
export function loadLandingSpotlightClient(): Promise<LandingSpotlightItem[]> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/landing/spotlight", { cache: "force-cache" });
      if (!res.ok) return [];
      const data = (await res.json()) as SpotlightResponse;
      const items = Array.isArray(data.items) ? data.items : [];
      cached = items;
      return items;
    } catch {
      return [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
