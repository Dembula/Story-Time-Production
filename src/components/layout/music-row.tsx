"use client";

import { ChevronLeft, ChevronRight, Music } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (!tracks?.length) return null;

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
        {tracks.map((track) => (
          <div
            key={track.id}
            className="group/card w-44 flex-shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-card/85 shadow-media hover:-translate-y-1 hover:border-white/14"
          >
            <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-slate-900">
              {track.coverUrl ? (
                <Image
                  src={track.coverUrl}
                  alt={track.title}
                  fill
                  sizes="(max-width: 768px) 35vw, 176px"
                  className="h-full w-full object-cover transition duration-300 group-hover/card:scale-[1.04] group-hover/card:brightness-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-500">
                  <Music className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-white group-hover/card:text-orange-100">{track.title}</p>
              <p className="truncate text-xs text-slate-400">{track.artistName}</p>
              {track.genre && (
                <p className="mt-0.5 text-xs text-slate-500">{track.genre}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
