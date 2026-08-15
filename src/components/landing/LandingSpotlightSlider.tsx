"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SpotlightItem = {
  id: string;
  title: string;
  type: string;
  year: number | null;
  category: string | null;
  posterUrl: string | null;
  creatorName: string | null;
};

type LandingSpotlightSliderProps = {
  /** Hero row uses standard cinematic poster widths (mobile + desktop). */
  variant?: "default" | "hero";
};

/** Marketing placeholders when the catalogue spotlight is empty. */
const FALLBACK_SPOTLIGHT: SpotlightItem[] = [
  { id: "spotlight-1", title: "The Second", type: "FILM", year: 2020, category: null, posterUrl: "/posters/poster-1.svg", creatorName: null },
  { id: "spotlight-2", title: "The Spider Web", type: "FILM", year: 2020, category: null, posterUrl: "/posters/poster-2.svg", creatorName: null },
  { id: "spotlight-3", title: "The Pass", type: "FILM", year: 2020, category: null, posterUrl: "/posters/poster-3.svg", creatorName: null },
  { id: "spotlight-4", title: "Night Signal", type: "FILM", year: 2021, category: null, posterUrl: "/posters/poster-1.svg", creatorName: null },
  { id: "spotlight-5", title: "Open Water", type: "FILM", year: 2021, category: null, posterUrl: "/posters/poster-2.svg", creatorName: null },
  { id: "spotlight-6", title: "Glass Room", type: "SERIES", year: 2022, category: null, posterUrl: "/posters/poster-3.svg", creatorName: null },
  { id: "spotlight-7", title: "After Light", type: "FILM", year: 2022, category: null, posterUrl: "/posters/poster-1.svg", creatorName: null },
  { id: "spotlight-8", title: "Harbour", type: "FILM", year: 2023, category: null, posterUrl: "/posters/poster-2.svg", creatorName: null },
  { id: "spotlight-9", title: "Kin", type: "SERIES", year: 2023, category: null, posterUrl: "/posters/poster-3.svg", creatorName: null },
  { id: "spotlight-10", title: "Still Frame", type: "FILM", year: 2024, category: null, posterUrl: "/posters/poster-1.svg", creatorName: null },
];

export function LandingSpotlightSlider({ variant = "default" }: LandingSpotlightSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<SpotlightItem[]>(FALLBACK_SPOTLIGHT);
  const hero = variant === "hero";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/landing/spotlight", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: SpotlightItem[] };
        if (!cancelled && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
      } catch {
        // Keep marketing fallbacks when the API is unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollBy = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-spotlight-card]");
    const step = card ? card.offsetWidth + 12 : Math.max(120, track.clientWidth * 0.7);
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  // Fixed rem widths (not vw) so the row never widens the page. Mobile hero cards
  // stay compact (~3+ across) so the first screen keeps breathing room around the mark.
  const cardClass = hero
    ? "group relative block shrink-0 snap-start overflow-hidden w-[5.75rem] min-w-[5.75rem] max-w-[5.75rem] sm:w-[7.5rem] sm:min-w-[7.5rem] sm:max-w-[7.5rem] lg:w-[9rem] lg:min-w-[9rem] lg:max-w-[9rem]"
    : "group relative block shrink-0 snap-start overflow-hidden w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] sm:w-[7rem] sm:min-w-[7rem] sm:max-w-[7rem]";

  return (
    <section
      className={`w-full min-w-0 max-w-full overflow-hidden ${hero ? "mt-0" : "mx-auto mt-10 px-0"}`}
      aria-label="Top on Story Time"
    >
      <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-4">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-orange-300/75">Top 10</p>
          <h2 className={`mt-0.5 font-display font-semibold text-white ${hero ? "text-base sm:text-xl lg:text-2xl" : "text-lg"}`}>
            On Story Time
          </h2>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-orange-200 transition hover:border-orange-300/35 hover:bg-orange-500/18 hover:text-white sm:h-9 sm:w-9"
            aria-label="Previous title"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-orange-200 transition hover:border-orange-300/35 hover:bg-orange-500/18 hover:text-white sm:h-9 sm:w-9"
            aria-label="Next title"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex min-w-0 w-full snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3.5 lg:gap-4"
      >
        {items.map((item, index) => {
          const isFallback = item.id.startsWith("spotlight-");
          const href = isFallback
            ? "/auth/signup"
            : `/auth/signup?callbackUrl=${encodeURIComponent(`/browse/content/${item.id}`)}`;
          const unoptimized =
            Boolean(item.posterUrl?.includes(".gif")) || Boolean(item.posterUrl?.endsWith(".svg"));
          return (
            <Link
              key={item.id}
              href={href}
              data-spotlight-card
              className={cardClass}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-orange-400/15 bg-white/[0.03] transition group-hover:border-orange-300/35">
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    fill
                    sizes={hero ? "(max-width: 640px) 92px, (max-width: 1024px) 120px, 144px" : "(max-width: 640px) 88px, 112px"}
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    unoptimized={unoptimized}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 px-2 text-center">
                    <span className="line-clamp-3 text-[11px] font-medium leading-snug text-slate-300">
                      {item.title}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute bottom-1 left-1.5 font-display text-2xl font-bold leading-none text-orange-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] sm:bottom-1.5 sm:text-3xl lg:text-4xl">
                  {index + 1}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-1 text-left text-[11px] font-medium leading-snug text-slate-300 group-hover:text-white sm:mt-2 sm:line-clamp-2 sm:text-xs">
                {item.title}
              </p>
              {item.year ? (
                <p className="mt-0.5 hidden line-clamp-1 text-left text-[10px] text-slate-500 sm:block">{item.year}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
