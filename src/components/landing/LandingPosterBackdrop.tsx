"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressivePoster, useSequentialPosterUnlock } from "@/components/landing/progressive-poster";
import { loadLandingSpotlightClient } from "@/lib/landing-spotlight-client";

const FALLBACK_POSTERS = [
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
];

type Poster = { src: string; alt: string };

function chunkRows(posters: Poster[], rows: number, perRow: number): Poster[][] {
  const needed = rows * perRow;
  const pool = [...posters];
  while (pool.length < needed) pool.push(...posters);
  return Array.from({ length: rows }, (_, row) =>
    pool.slice(row * perRow, row * perRow + perRow),
  );
}

/**
 * Faded film-poster backdrop — full 15 on mobile / 12 on desktop.
 * Images unlock one-by-one (mobile) with a soft fade so Safari/Chrome never
 * decode the whole wall at once — still feels cinematic, not sparse.
 */
export function LandingPosterBackdrop() {
  const [posters, setPosters] = useState<Poster[]>(
    FALLBACK_POSTERS.map((src, i) => ({ src, alt: `Featured title ${i + 1}` })),
  );

  useEffect(() => {
    let cancelled = false;
    void loadLandingSpotlightClient().then((items) => {
      if (cancelled) return;
      const fromApi = items
        .filter((item) => Boolean(item.posterUrl))
        .map((item) => ({ src: item.posterUrl as string, alt: item.title }));
      if (fromApi.length >= 3) setPosters(fromApi);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mobileFlat = useMemo(() => chunkRows(posters, 3, 5).flat(), [posters]);
  const desktopFlat = useMemo(() => chunkRows(posters, 3, 4).flat(), [posters]);
  const posterKey = useMemo(() => posters.map((p) => p.src).join("|"), [posters]);
  const mobileUnlock = useSequentialPosterUnlock(mobileFlat.length, posterKey);
  const desktopUnlock = useSequentialPosterUnlock(desktopFlat.length, posterKey);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Mobile: full 3×5 grid — sequential decode */}
      <div className="absolute inset-0 lg:hidden">
        <div className="absolute inset-x-0 top-0 bottom-[28%] grid grid-cols-5 grid-rows-3 gap-2 px-2 pt-14 opacity-[0.22]">
          {mobileFlat.map((poster, index) => (
            <ProgressivePoster
              key={`m-${poster.src}-${index}`}
              src={poster.src}
              index={index}
              unlockedThrough={mobileUnlock.unlockedThrough}
              onSettled={mobileUnlock.onSettled}
              sizes="72px"
              className="rounded-md"
              priority={index === 0}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.28)_18%,rgba(0,0,0,0.78)_68%,#000_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/85 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
      </div>

      {/* Desktop: 3×4 on the right — faster unlock, still staggered */}
      <div className="absolute inset-y-0 right-0 hidden w-[50%] lg:block xl:w-[46%]">
        <div className="absolute inset-y-[10%] right-0 grid w-full grid-cols-4 grid-rows-3 gap-3 px-3 opacity-[0.32]">
          {desktopFlat.map((poster, index) => (
            <ProgressivePoster
              key={`d-${poster.src}-${index}`}
              src={poster.src}
              index={index}
              unlockedThrough={desktopUnlock.unlockedThrough}
              onSettled={desktopUnlock.onSettled}
              sizes="120px"
              className="rounded-lg border border-white/[0.06]"
              priority={index < 2}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.75)_16%,rgba(0,0,0,0.28)_50%,rgba(0,0,0,0.5)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      </div>
    </div>
  );
}
