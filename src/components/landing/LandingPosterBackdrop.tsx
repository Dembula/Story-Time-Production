"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_POSTERS = [
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
  "/posters/poster-1.svg",
  "/posters/poster-2.svg",
  "/posters/poster-3.svg",
];

type Poster = { src: string; alt: string };

/**
 * Faded film-poster rows behind the hero — no glow orbs.
 * Mobile: fills the upper field behind the mark.
 * Desktop: fills the empty right side of the hero.
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
          // Repeat to fill a wide row without looking sparse
          const filled = [...fromApi, ...fromApi, ...fromApi].slice(0, 12);
          setPosters(filled);
        }
      } catch {
        // Keep SVG fallbacks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Mobile / tablet: lined-up faded poster rows behind the mark */}
      <div className="absolute inset-0 lg:hidden">
        <div className="absolute left-1/2 top-[18%] flex w-[160%] -translate-x-1/2 gap-2 opacity-[0.22]">
          {posters.slice(0, 8).map((poster, i) => (
            <div
              key={`m-a-${poster.src}-${i}`}
              className="relative aspect-[2/3] w-[22%] min-w-[5.5rem] shrink-0 overflow-hidden rounded-md"
            >
              <Image src={poster.src} alt="" fill sizes="90px" className="object-cover" unoptimized={poster.src.includes(".gif")} />
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-[42%] flex w-[170%] -translate-x-1/2 gap-2 opacity-[0.14]">
          {posters.slice(2, 10).map((poster, i) => (
            <div
              key={`m-b-${poster.src}-${i}`}
              className="relative aspect-[2/3] w-[20%] min-w-[5rem] shrink-0 overflow-hidden rounded-md"
            >
              <Image src={poster.src} alt="" fill sizes="80px" className="object-cover" unoptimized={poster.src.includes(".gif")} />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_20%,rgba(0,0,0,0.82)_70%,#000_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/90 to-transparent" />
      </div>

      {/* Desktop: faded poster stack filling the empty right side */}
      <div className="absolute inset-y-0 right-0 hidden w-[52%] lg:block xl:w-[48%]">
        <div className="absolute inset-y-[8%] right-0 flex items-center justify-end gap-3 pr-2 xl:gap-4 xl:pr-4">
          {posters.slice(0, 5).map((poster, i) => (
            <div
              key={`d-${poster.src}-${i}`}
              className={[
                "relative aspect-[2/3] shrink-0 overflow-hidden rounded-xl border border-white/[0.06]",
                i === 0 ? "h-[58%] opacity-[0.28]" : "",
                i === 1 ? "h-[68%] opacity-[0.34]" : "",
                i === 2 ? "h-[78%] opacity-[0.38]" : "",
                i === 3 ? "h-[66%] opacity-[0.3]" : "",
                i === 4 ? "h-[56%] opacity-[0.24]" : "",
              ].join(" ")}
            >
              <Image
                src={poster.src}
                alt=""
                fill
                sizes="(max-width: 1280px) 140px, 180px"
                className="object-cover"
                priority={i < 2}
                unoptimized={poster.src.includes(".gif")}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.72)_18%,rgba(0,0,0,0.35)_48%,rgba(0,0,0,0.55)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      </div>
    </div>
  );
}
