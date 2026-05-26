"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ContinueItem = {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  category: string | null;
  type: string;
  progressPercent: number;
};

export function ContinueWatchingRow() {
  const { data: session, status } = useSession();
  if (status === "loading" || !session) return null;
  return <ContinueWatchingRowInner />;
}

function ContinueWatchingRowInner() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["continue-watching"],
    queryFn: () => fetch("/api/watch/continue-watching").then((r) => r.json()),
    staleTime: 30_000,
  });

  const items = (Array.isArray(data) ? data : []) as ContinueItem[];

  if (isLoading) {
    return (
      <div className="mb-12">
        <Skeleton className="mb-4 h-7 w-48 bg-white/[0.06]" />
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
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <div id="continue-watching" className="mb-14 group/row">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Continue Watching</h2>
          <p className="mt-1 text-sm text-slate-400">Pick up where you left off</p>
        </div>
        <div className="flex gap-2 opacity-0 transition group-hover/row:opacity-100">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 hover:bg-white/[0.12]"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 hover:bg-white/[0.12]"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/browse/content/${item.id}/watch`}
            className="group/card block w-52 shrink-0"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-card shadow-media">
              {item.posterUrl || item.backdropUrl ? (
                <Image
                  src={item.posterUrl || item.backdropUrl || ""}
                  alt={item.title}
                  fill
                  sizes="208px"
                  className="object-cover transition duration-300 group-hover/card:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No image</div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover/card:opacity-100">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
                  <Play className="h-6 w-6 fill-current" />
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                />
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-medium text-white">{item.title}</p>
            {item.progressPercent > 0 && (
              <p className="text-xs text-slate-400">{item.progressPercent}% watched</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
