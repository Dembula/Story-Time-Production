"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  browsePosterCardClass,
  browsePosterCardImageSizes,
  browsePosterCardSkeletonClass,
  browsePosterMediaClass,
  browseRowGapClass,
} from "@/lib/browse-card-layout";
import { markPlaybackPlayIntent } from "@/lib/player/play-intent";
import { HorizontalScrollRow } from "@/components/layout/horizontal-scroll-row";

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
        <div className={`flex overflow-hidden ${browseRowGapClass}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={`${browsePosterCardSkeletonClass} bg-white/[0.06]`} />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <HorizontalScrollRow
      id="continue-watching"
      className="mb-14"
      title={<h2 className="font-display text-xl font-semibold text-white">Continue Watching</h2>}
      subtitle="Pick up where you left off"
      scrollClassName={`flex overflow-x-auto scroll-smooth pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] ${browseRowGapClass}`}
    >
      {items.map((item) => (
        <div key={item.id} className={browsePosterCardClass}>
        <Link
          href={`/browse/content/${item.id}/watch`}
          className="group/card block"
          onClick={() => markPlaybackPlayIntent()}
        >
          <div className={browsePosterMediaClass}>
            {item.posterUrl || item.backdropUrl ? (
              <Image
                src={item.posterUrl || item.backdropUrl || ""}
                alt={item.title}
                fill
                sizes={browsePosterCardImageSizes}
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
          <p className="mt-2 truncate text-xs font-medium text-white sm:mt-3 sm:text-sm">{item.title}</p>
          {item.progressPercent > 0 && (
            <p className="text-xs text-slate-400">{item.progressPercent}% watched</p>
          )}
        </Link>
        </div>
      ))}
    </HorizontalScrollRow>
  );
}
