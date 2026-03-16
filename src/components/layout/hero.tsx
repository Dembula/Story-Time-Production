"use client";

import Link from "next/link";
import { Play, Info } from "lucide-react";
import { useEffect, useState } from "react";

type Content = {
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  videoUrl: string | null;
  category: string | null;
};

export function Hero({ content }: { content: Content[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (content.length <= 1) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % Math.min(content.length, 5));
    }, 6000);
    return () => clearInterval(t);
  }, [content.length]);

  const current = content[activeIndex];

  if (!content?.length || !current) {
    return (
      <div className="relative h-[50vh] min-h-[350px] flex items-center justify-center bg-gradient-to-b from-slate-900/80 to-[#0c1222]">
        <div className="text-center max-w-xl px-6">
          <h1 className="text-4xl md:text-5xl font-semibold text-white mb-4">
            Discover Independent Content
          </h1>
          <p className="text-slate-400 mb-8">
            Movies, series, shows, and podcasts from creators around the world. Sign up to explore.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-[450px] flex items-end">
      <div className="absolute inset-0">
        {(current.backdropUrl || current.posterUrl) ? (
          <img
            src={current.backdropUrl || current.posterUrl || ""}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-800 to-[#0c1222]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1222] via-[#0c1222]/70 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 pb-20">
        <h1 className="text-4xl md:text-6xl font-semibold text-white drop-shadow-lg">
          {current.title}
        </h1>
        {current.category && (
          <p className="mt-2 text-slate-300 text-sm font-medium">{current.category}</p>
        )}
        {current.description && (
          <p className="mt-4 text-lg text-slate-300 max-w-2xl line-clamp-3">
            {current.description}
          </p>
        )}
        <div className="mt-6 flex gap-4">
          <Link
            href={`/browse/content/${current.id}?play=1`}
            className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition"
          >
            <Play className="w-5 h-5 fill-current" />
            Play
          </Link>
          <Link
            href={`/browse/content/${current.id}`}
            className="flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white/15 backdrop-blur-sm text-white font-semibold hover:bg-white/25 transition border border-white/20"
          >
            <Info className="w-5 h-5" />
            More Info
          </Link>
        </div>
      </div>

      {content.length > 1 && (
        <div className="absolute bottom-8 right-8 md:right-20 flex gap-2 z-10">
          {content.slice(0, 5).map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveIndex(i)}
              className={`h-1 rounded-full transition-all ${
                i === activeIndex ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
