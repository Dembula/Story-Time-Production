"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayBackdropUrl } from "@/lib/content-media-urls";
import { useWarmHeroBackdrops } from "@/components/prefetch/platform-media-prefetch";

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

  const heroBackdropUrls = useMemo(
    () =>
      content.slice(0, 5).map((item) => {
        const packed = item.backdropUrl?.trim();
        if (packed && /^https?:\/\//i.test(packed)) return packed;
        return getDisplayBackdropUrl({
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          videoUrl: item.videoUrl,
        });
      }),
    [content],
  );
  useWarmHeroBackdrops(heroBackdropUrls, activeIndex);

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
            className="inline-flex items-center gap-2 rounded-xl viewer-btn-primary px-8 py-3 font-semibold transition hover:-translate-y-0.5"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  // Prefer server-packed backdrop (signed HTTPS). Never use portrait poster when a
  // backdrop was uploaded — that looks cropped/wrong on the wide hero.
  const packedBackdrop = current.backdropUrl?.trim();
  const backdrop =
    packedBackdrop && /^https?:\/\//i.test(packedBackdrop)
      ? packedBackdrop
      : getDisplayBackdropUrl({
          posterUrl: current.posterUrl,
          backdropUrl: current.backdropUrl,
          videoUrl: current.videoUrl,
        });

  return (
    <div className="relative flex h-[58vh] min-h-[320px] max-h-[640px] items-end overflow-hidden cinematic-vignette sm:h-[64vh] sm:min-h-[400px] md:h-[68vh] md:min-h-[440px]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-24 sm:px-6 sm:pb-14 md:px-12 md:pb-16">
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
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:bottom-8">
          {content.slice(0, 5).map((c, i) => (
            <span
              key={c.id}
              aria-hidden
              className={`h-1 rounded-full transition-all duration-500 ${
                i === activeIndex ? "w-7 bg-orange-300/95" : "w-1.5 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
