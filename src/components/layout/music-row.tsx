"use client";

import { Music } from "lucide-react";
import Image from "next/image";
import {
  browseMusicCardClass,
  browseMusicCardImageSizes,
  browseRowGapClass,
} from "@/lib/browse-card-layout";
import { HorizontalScrollRow } from "@/components/layout/horizontal-scroll-row";

type MusicTrack = {
  id: string;
  title: string;
  artistName: string;
  genre: string | null;
  coverUrl: string | null;
};

export function MusicRow({
  title,
  subtitle,
  tracks,
}: {
  title: string;
  subtitle?: string;
  tracks: MusicTrack[];
}) {
  if (!tracks?.length) return null;

  return (
    <HorizontalScrollRow
      className="mb-12"
      title={<h2 className="font-display text-xl font-semibold text-white">{title}</h2>}
      subtitle={subtitle}
      scrollClassName={`flex overflow-x-auto scroll-smooth pb-2 scrollbar-hide [-webkit-overflow-scrolling:touch] ${browseRowGapClass}`}
    >
      {tracks.map((track) => (
        <div
          key={track.id}
          className={`group/card overflow-hidden rounded-xl border border-white/8 bg-card/85 shadow-media hover:-translate-y-1 hover:border-white/14 sm:rounded-2xl ${browseMusicCardClass}`}
        >
          <div className="relative aspect-square overflow-hidden rounded-t-xl bg-slate-900 sm:rounded-t-2xl">
            {track.coverUrl ? (
              <Image
                src={track.coverUrl}
                alt={track.title}
                fill
                sizes={browseMusicCardImageSizes}
                className="h-full w-full object-cover transition duration-300 group-hover/card:scale-[1.04] group-hover/card:brightness-110"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-500">
                <Music className="h-12 w-12" />
              </div>
            )}
          </div>
          <div className="p-2 sm:p-3">
            <p className="truncate text-xs font-medium text-white sm:text-sm group-hover/card:text-orange-100">{track.title}</p>
            <p className="truncate text-[11px] text-slate-400 sm:text-xs">{track.artistName}</p>
            {track.genre && (
              <p className="mt-0.5 text-xs text-slate-500">{track.genre}</p>
            )}
          </div>
        </div>
      ))}
    </HorizontalScrollRow>
  );
}
