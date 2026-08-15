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
  /** Larger posters for the landing hero (mobile + desktop). */
  variant?: "default" | "hero";
};

export function LandingSpotlightSlider({ variant = "default" }: LandingSpotlightSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<SpotlightItem[] | null>(null);
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
        // Stay hidden when unavailable
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

  if (!items?.length) return null;

  // Fixed rem widths (not vw) so the row never widens the page. Mobile hero cards
  // are sized to fill ~2 posters across a phone — not four skinny “half squares”.
  const cardClass = hero
    ? "group relative block shrink-0 snap-start overflow-hidden w-[10.25rem] min-w-[10.25rem] max-w-[10.25rem] sm:w-[9rem] sm:min-w-[9rem] sm:max-w-[9rem] lg:w-[10rem] lg:min-w-[10rem] lg:max-w-[10rem]"
    : "group relative block shrink-0 snap-start overflow-hidden w-[8.5rem] min-w-[8.5rem] max-w-[8.5rem] sm:w-[7.25rem] sm:min-w-[7.25rem] sm:max-w-[7.25rem]";

  return (
    <section
      className={`w-full min-w-0 max-w-full overflow-hidden ${hero ? "mt-0" : "mx-auto mt-10 px-0"}`}
      aria-label="Top on Story Time"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-orange-300/75">Top 10</p>
          <h2 className={`mt-1 font-display font-semibold text-white ${hero ? "text-xl sm:text-2xl" : "text-lg"}`}>
            On Story Time
          </h2>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-orange-200 transition hover:border-orange-300/35 hover:bg-orange-500/18 hover:text-white"
            aria-label="Previous title"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-orange-200 transition hover:border-orange-300/35 hover:bg-orange-500/18 hover:text-white"
            aria-label="Next title"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex min-w-0 w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3.5 lg:gap-4"
      >
        {items.map((item, index) => {
          const callbackUrl = encodeURIComponent(`/browse/content/${item.id}`);
          return (
            <Link
              key={item.id}
              href={`/auth/signup?callbackUrl=${callbackUrl}`}
              data-spotlight-card
              className={cardClass}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-orange-400/15 bg-white/[0.03] transition group-hover:border-orange-300/35">
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    fill
                    sizes={hero ? "(max-width: 640px) 164px, (max-width: 1024px) 144px, 160px" : "(max-width: 640px) 136px, 116px"}
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    unoptimized={item.posterUrl.includes(".gif")}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-900 px-2 text-center">
                    <span className="line-clamp-3 text-[11px] font-medium leading-snug text-slate-300">
                      {item.title}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                <span className="absolute bottom-1.5 left-1.5 font-display text-4xl font-bold leading-none text-orange-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] sm:text-4xl">
                  {index + 1}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-left text-xs font-medium leading-snug text-slate-300 group-hover:text-white">
                {item.title}
              </p>
              {item.year ? (
                <p className="mt-0.5 line-clamp-1 text-left text-[10px] text-slate-500">{item.year}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
