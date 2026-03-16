"use client";

import { ChevronLeft, ChevronRight, Music } from "lucide-react";
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
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex-shrink-0 w-44 group/card rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition"
          >
            <div className="relative aspect-square rounded-t-xl overflow-hidden bg-slate-800">
              {track.coverUrl ? (
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <Music className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <p className="text-xs text-slate-400 truncate">{track.artistName}</p>
              {track.genre && (
                <p className="text-xs text-slate-500 mt-0.5">{track.genre}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
