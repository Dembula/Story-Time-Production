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
            <Skeleton key={i} className="w-48 h-72 flex-shrink-0 rounded-xl bg-slate-800" />
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
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        </div>
        <div className="opacity-0 group-hover/row:opacity-100 transition flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="p-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 transition"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 transition"
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
            className="flex-shrink-0 w-52 group/card block"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800">
              {item.posterUrl || item.backdropUrl ? (
                <img
                  src={item.posterUrl || item.backdropUrl || ""}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
                {item.category && (
                  <p className="text-xs text-slate-300 mt-1">{item.category}</p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 font-medium">
                  View details
                </span>
              </div>
              {item._count?.ratings ? (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-xs text-slate-200">
                  {item._count.ratings} ratings
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium text-white truncate">{item.title}</p>
            {item.category && (
              <p className="text-xs text-slate-400 truncate">{item.category}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
