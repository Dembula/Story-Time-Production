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

export function LandingSpotlightSlider() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<SpotlightItem[] | null>(null);

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
    const step = card ? card.offsetWidth + 12 : track.clientWidth * 0.75;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  if (!items?.length) return null;

  return (
    <section className="mt-10 w-full max-w-[min(100%,24rem)] sm:max-w-lg" aria-label="Discover on Story Time">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="text-left">
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-slate-500">Discover</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-white">Top on Story Time</h2>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Previous title"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Next title"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/browse/content/${item.id}`}
            data-spotlight-card
            className="group relative w-[7.25rem] shrink-0 snap-start sm:w-[8.5rem]"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)]">
              {item.posterUrl ? (
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  sizes="120px"
                  className="object-cover transition duration-300 group-active:scale-[1.02]"
                  unoptimized={item.posterUrl.includes(".gif")}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-orange-950/40 to-slate-900 px-2 text-center">
                  <span className="line-clamp-3 text-[11px] font-medium leading-snug text-orange-100/90">
                    {item.title}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
              <span className="absolute left-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-black/55 px-1.5 text-[11px] font-bold tabular-nums text-orange-200 ring-1 ring-white/10 backdrop-blur-sm">
                {index + 1}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-left text-xs font-medium leading-snug text-slate-200 group-hover:text-white">
              {item.title}
            </p>
            {(item.creatorName || item.year) && (
              <p className="mt-0.5 line-clamp-1 text-left text-[10px] text-slate-500">
                {[item.creatorName, item.year].filter(Boolean).join(" · ")}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
