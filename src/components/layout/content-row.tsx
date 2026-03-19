"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type ContentItem = {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  category: string | null;
  type: string;
  _count?: { ratings: number };
};

export function ContentRow({
  title,
  subtitle,
  contents,
  loading,
}: {
  title: string;
  subtitle?: string;
  contents: ContentItem[];
  loading?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (loading) {
    return (
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-48 flex-shrink-0 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (!contents?.length) return null;

  return (
    <div className="mb-12 group/row">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="opacity-0 group-hover/row:opacity-100 transition flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 shadow-panel hover:-translate-y-0.5 hover:bg-white/[0.12]"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 shadow-panel hover:-translate-y-0.5 hover:bg-white/[0.12]"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
      >
        {contents.map((item) => (
          <Link
            key={item.id}
            href={`/browse/content/${item.id}`}
            className="group/card block w-52 flex-shrink-0"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/8 bg-card shadow-media">
              {item.posterUrl || item.backdropUrl ? (
                <img
                  src={item.posterUrl || item.backdropUrl || ""}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-300 group-hover/card:scale-[1.04] group-hover/card:brightness-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/24 to-transparent opacity-0 transition-all duration-300 group-hover/card:opacity-100 flex flex-col justify-end p-4">
                <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                {item.category && (
                  <p className="text-xs text-slate-300 mt-1">{item.category}</p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-300">
                  View details
                </span>
              </div>
              {item._count?.ratings ? (
                <div className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-xs text-slate-100 backdrop-blur-sm">
                  {item._count.ratings} ratings
                </div>
              ) : null}
            </div>
            <p className="mt-3 truncate text-sm font-medium text-white group-hover/card:text-orange-100">{item.title}</p>
            {item.category && (
              <p className="truncate text-xs text-slate-400">{item.category}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
