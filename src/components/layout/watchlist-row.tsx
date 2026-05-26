"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

type WatchlistItem = {
  content: {
    id: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    videoUrl: string | null;
    trailerUrl: string | null;
    category: string | null;
    type: string;
  };
};

export function WatchlistRow() {
  const { data: session, status } = useSession();
  if (status === "loading" || !session) return null;
  return <WatchlistRowInner />;
}

function WatchlistRowInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
    staleTime: 30_000,
  });

  const items = (Array.isArray(data) ? data : []) as WatchlistItem[];

  if (isLoading) {
    return (
      <div className="mb-14">
        <Skeleton className="mb-4 h-7 w-40 bg-white/[0.06]" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-52 shrink-0 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollRef.current.clientWidth * 0.75 : scrollRef.current.clientWidth * 0.75,
      behavior: "smooth",
    });
  }

  return (
    <div id="my-list" className="group/row mb-14">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">My List</h2>
          <p className="mt-1 text-sm text-slate-400">Titles you saved to watch later</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/browse/my-list" className="text-xs font-medium text-orange-300 hover:text-orange-200">
            See all
          </Link>
          <div className="flex gap-2 opacity-0 transition group-hover/row:opacity-100">
            <button type="button" onClick={() => scroll("left")} className="rounded-full border border-white/10 bg-white/[0.06] p-2.5" aria-label="Scroll left">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <button type="button" onClick={() => scroll("right")} className="rounded-full border border-white/10 bg-white/[0.06] p-2.5" aria-label="Scroll right">
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 scrollbar-hide"
      >
        {items.slice(0, 12).map(({ content: c }) => {
          const poster = getDisplayPosterUrl(c) ?? c.posterUrl;
          return (
            <Link
              key={c.id}
              href={`/browse/content/${c.id}`}
              className="group/card w-52 shrink-0 snap-start"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-card shadow-media transition duration-300 group-hover/card:scale-[1.03] group-hover/card:shadow-[var(--cin-depth-1)]">
                {poster ? (
                  <Image src={poster} alt={c.title} fill sizes="208px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-900">
                    <Bookmark className="h-8 w-8 text-slate-600" />
                  </div>
                )}
              </div>
              <p className="mt-3 truncate text-sm font-medium text-white">{c.title}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
