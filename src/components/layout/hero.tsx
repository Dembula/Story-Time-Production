"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

type Content = {
  id: string;
  title: string;
  description: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  videoUrl: string | null;
  trailerUrl?: string | null;
  category: string | null;
};

export function Hero({ content }: { content: Content[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (content.length <= 1) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % Math.min(content.length, 5));
    }, 7000);
    return () => clearInterval(t);
  }, [content.length]);

  const current = content[activeIndex];

  if (!content?.length || !current) {
    return (
      <div className="relative flex min-h-[350px] h-[50vh] items-center justify-center">
        <div className="text-center max-w-xl px-6">
          <h1 className="mb-4 font-display text-4xl font-semibold text-white md:text-5xl">
            Discover Independent Content
          </h1>
          <p className="mb-8 text-slate-300/80">
            Movies, series, shows, and podcasts from creators around the world.
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-3 font-semibold text-white shadow-glow hover:bg-orange-400"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  const backdrop =
    getDisplayPosterUrl({
      posterUrl: current.posterUrl,
      backdropUrl: current.backdropUrl,
      videoUrl: current.videoUrl,
      trailerUrl: current.trailerUrl,
    }) ??
    current.backdropUrl ??
    current.posterUrl;

  return (
    <div className="relative h-[72vh] min-h-[460px] flex items-end cinematic-vignette overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {backdrop ? (
            <Image
              src={backdrop}
              alt=""
              fill
              sizes="100vw"
              priority
              className="h-full w-full object-cover brightness-[0.82] contrast-105"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-slate-900 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090d17] via-[#090d17]/75 to-[#090d17]/15" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_12%,rgba(255,165,54,0.18),transparent_32%)]" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 pb-20 pt-32">
        <motion.div
          key={`copy-${current.id}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <h1 className="font-display text-4xl font-semibold text-white drop-shadow-lg md:text-6xl md:leading-tight">
            {current.title}
          </h1>
          {current.category && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange-200/90">
              {current.category}
            </p>
          )}
          {current.description && (
            <p className="mt-4 max-w-2xl line-clamp-3 text-lg leading-8 text-slate-200/90">
              {current.description}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/browse/content/${current.id}?play=1`}
              className="flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 font-semibold text-slate-950 shadow-panel transition hover:bg-white/92"
            >
              <Play className="w-5 h-5 fill-current" />
              Play
            </Link>
            <Link
              href={`/browse/content/${current.id}`}
              className="flex items-center gap-2 rounded-2xl border border-white/14 bg-white/[0.08] px-8 py-3.5 font-semibold text-white backdrop-blur-md transition hover:bg-white/[0.14]"
            >
              <Info className="w-5 h-5" />
              More Info
            </Link>
          </div>
        </motion.div>
      </div>

      {content.length > 1 && (
        <div className="absolute bottom-8 right-8 md:right-20 flex gap-2 z-10">
          {content.slice(0, 5).map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show ${c.title}`}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-8 bg-orange-300 shadow-[0_0_16px_rgba(255,179,71,0.8)]" : "w-2 bg-white/45 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
