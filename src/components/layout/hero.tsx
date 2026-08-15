"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getDisplayBackdropUrl } from "@/lib/content-media-urls";

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

function resolveHeroBackdrop(item: Content): string | null {
  const packedBackdrop = item.backdropUrl?.trim();
  if (packedBackdrop && /^https?:\/\//i.test(packedBackdrop)) return packedBackdrop;
  return getDisplayBackdropUrl({
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    videoUrl: item.videoUrl,
  });
}

export function Hero({ content }: { content: Content[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = useMemo(() => content.slice(0, 5), [content]);

  const backdrops = useMemo(
    () => slides.map((item) => ({ id: item.id, url: resolveHeroBackdrop(item) })),
    [slides],
  );

  // Keep slides mounted and crossfade — avoids remount flashes and lets next
  // backdrops finish loading before they become visible.
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  // High-priority preload for the active + next backdrop (browser cache / decode).
  useEffect(() => {
    if (typeof document === "undefined" || !backdrops.length) return;
    const urls = [
      backdrops[activeIndex]?.url,
      backdrops[(activeIndex + 1) % backdrops.length]?.url,
    ].filter((url): url is string => Boolean(url));

    const links: HTMLLinkElement[] = [];
    for (const url of urls) {
      const existing = document.head.querySelector(`link[data-hero-backdrop="${CSS.escape(url)}"]`);
      if (existing) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.setAttribute("data-hero-backdrop", url);
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      // Keep preloads in head for the session; nothing to clean for stability.
      void links;
    };
  }, [activeIndex, backdrops]);

  const current = slides[activeIndex];

  if (!slides.length || !current) {
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

  return (
    <div className="relative flex h-[58vh] min-h-[320px] max-h-[640px] items-end overflow-hidden cinematic-vignette sm:h-[64vh] sm:min-h-[400px] md:h-[68vh] md:min-h-[440px]">
      {backdrops.map((slide, index) => {
        const active = index === activeIndex;
        return (
          <motion.div
            key={slide.id}
            className="absolute inset-0"
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            style={{ zIndex: active ? 1 : 0, pointerEvents: active ? "auto" : "none" }}
            aria-hidden={!active}
          >
            {slide.url ? (
              <Image
                src={slide.url}
                alt=""
                fill
                sizes="100vw"
                quality={90}
                priority={index === 0 || index === activeIndex || index === (activeIndex + 1) % backdrops.length}
                className="h-full w-full object-cover brightness-[0.88] contrast-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-b from-slate-900 to-slate-950" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/15" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          </motion.div>
        );
      })}

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 pt-24 sm:px-6 sm:pb-14 md:px-12 md:pb-16">
        <motion.div
          key={`copy-${current.id}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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

      {slides.length > 1 && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 md:bottom-8">
          {slides.map((c, i) => (
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
