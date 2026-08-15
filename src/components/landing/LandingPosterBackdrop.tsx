"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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
    pool.slice(row * perRow, row * perRow + perRow)
  );
}

/**
 * Faded film-poster backdrop — clean non-overlapping rows, no glow orbs.
 * Mobile: 3 even rows behind the mark.
 * Desktop: 3 even rows filling the empty right side.
 */
export function LandingPosterBackdrop() {
  const [posters, setPosters] = useState<Poster[]>(
    FALLBACK_POSTERS.map((src, i) => ({ src, alt: `Featured title ${i + 1}` }))
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/landing/spotlight", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: { title: string; posterUrl: string | null }[] };
        if (cancelled || !Array.isArray(data.items)) return;
        const fromApi = data.items
          .filter((item) => Boolean(item.posterUrl))
          .map((item) => ({ src: item.posterUrl as string, alt: item.title }));
        if (fromApi.length >= 3) {
          setPosters(fromApi);
        }
      } catch {
        // Keep SVG fallbacks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mobileRows = useMemo(() => chunkRows(posters, 3, 5), [posters]);
  const desktopRows = useMemo(() => chunkRows(posters, 3, 4), [posters]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Mobile: 3 clean equal rows — no overlap */}
      <div className="absolute inset-0 lg:hidden">
        <div className="absolute inset-x-0 top-0 bottom-[28%] flex flex-col justify-start gap-2 px-2 pt-14 opacity-[0.22]">
          {mobileRows.map((row, rowIndex) => (
            <div key={`m-row-${rowIndex}`} className="grid grid-cols-5 gap-2">
              {row.map((poster, i) => (
                <div
                  key={`m-${rowIndex}-${poster.src}-${i}`}
                  className="relative aspect-[2/3] overflow-hidden rounded-md"
                >
                  <Image
                    src={poster.src}
                    alt=""
                    fill
                    sizes="72px"
                    className="object-cover"
                    unoptimized={poster.src.includes(".gif")}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.28)_18%,rgba(0,0,0,0.78)_68%,#000_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/85 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/70 to-transparent" />
      </div>

      {/* Desktop: 3 clean rows on the right — no staggered overlap */}
      <div className="absolute inset-y-0 right-0 hidden w-[50%] lg:block xl:w-[46%]">
        <div className="absolute inset-y-[10%] right-0 flex w-full flex-col justify-center gap-3 px-3 opacity-[0.32]">
          {desktopRows.map((row, rowIndex) => (
            <div key={`d-row-${rowIndex}`} className="grid grid-cols-4 gap-3">
              {row.map((poster, i) => (
                <div
                  key={`d-${rowIndex}-${poster.src}-${i}`}
                  className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.06]"
                >
                  <Image
                    src={poster.src}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                    priority={rowIndex === 0 && i < 2}
                    unoptimized={poster.src.includes(".gif")}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.75)_16%,rgba(0,0,0,0.28)_50%,rgba(0,0,0,0.5)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      </div>
    </div>
  );
}
