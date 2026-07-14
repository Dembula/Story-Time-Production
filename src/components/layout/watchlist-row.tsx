"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { Bookmark } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import {
  browsePosterCardClass,
  browsePosterCardImageSizes,
  browsePosterCardSkeletonClass,
  browsePosterMediaClass,
  browseRowGapClass,
} from "@/lib/browse-card-layout";
import { HorizontalScrollRow } from "@/components/layout/horizontal-scroll-row";

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
      id="my-list"
      className="mb-14"
      title={<h2 className="font-display text-xl font-semibold text-white">My List</h2>}
      subtitle="Titles you saved to watch later"
      headerEnd={
        <Link href="/browse/my-list" className="text-xs font-medium text-orange-300 hover:text-orange-200">
          See all
        </Link>
      }
      scrollClassName={`flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] ${browseRowGapClass}`}
    >
      {items.slice(0, 12).map(({ content: c }) => {
        const poster = getDisplayPosterUrl(c) ?? c.posterUrl;
        return (
          <div key={c.id} className={browsePosterCardClass}>
          <Link
            href={`/browse/content/${c.id}`}
            className="group/card block"
          >
            <div className={`${browsePosterMediaClass} transition duration-300 group-hover/card:shadow-[var(--cin-depth-1)]`}>
              {poster ? (
                <Image src={poster} alt={c.title} fill sizes={browsePosterCardImageSizes} className="object-cover transition duration-300 group-hover/card:scale-[1.03]" />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-900">
                  <Bookmark className="h-8 w-8 text-slate-600" />
                </div>
              )}
            </div>
            <p className="mt-2 truncate text-xs font-medium text-white sm:mt-3 sm:text-sm">{c.title}</p>
          </Link>
          </div>
        );
      })}
    </HorizontalScrollRow>
  );
}
