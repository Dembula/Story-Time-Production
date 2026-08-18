"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSpotlightSlider } from "@/components/landing/LandingSpotlightSlider";

type Poster = { id: string; title: string; posterUrl: string | null };

const FALLBACK_POSTERS = [
  { id: "p1", title: "", posterUrl: "/posters/poster-1.svg" },
  { id: "p2", title: "", posterUrl: "/posters/poster-2.svg" },
  { id: "p3", title: "", posterUrl: "/posters/poster-3.svg" },
  { id: "p4", title: "", posterUrl: "/posters/poster-1.svg" },
  { id: "p5", title: "", posterUrl: "/posters/poster-2.svg" },
  { id: "p6", title: "", posterUrl: "/posters/poster-3.svg" },
];

function LandingPosterField() {
  const [posters, setPosters] = useState<Poster[]>(FALLBACK_POSTERS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/landing/spotlight", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: Poster[] };
        const withArt = (data.items ?? []).filter((item) => item.posterUrl);
        if (!cancelled && withArt.length >= 3) {
          setPosters(withArt.slice(0, 9));
        }
      } catch {
        // Keep fallbacks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(52%,40rem)] overflow-hidden lg:block">
      <div className="absolute inset-0 grid grid-cols-3 gap-2.5 p-3 opacity-[0.55]">
        {posters.slice(0, 9).map((poster, index) => (
          <div
            key={`${poster.id}-${index}`}
            className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-950"
          >
            {poster.posterUrl ? (
              <Image
                src={poster.posterUrl}
                alt=""
                fill
                sizes="180px"
                className="object-cover"
                unoptimized={poster.posterUrl.includes(".gif")}
                priority={index < 3}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-[4.75rem] sm:px-6 sm:pb-12 sm:pt-24 lg:pb-16 lg:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-black" />
      <LandingPosterField />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl">
        <LandingReveal className="w-full min-w-0">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center lg:mx-0 lg:max-w-lg lg:items-start lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[11px] font-medium uppercase tracking-[0.28em] text-orange-300/80"
            >
              Independent streaming
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-3 font-display text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]"
            >
              Stories, on your <span className="text-orange-300">terms.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-400 sm:text-base"
            >
              Watch creator-owned films and series. Build and release work without the middleman.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="mt-7 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center lg:max-w-none"
            >
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/92 active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-current" />
                Enter platform
              </Link>
              <Link
                href="/auth/creator/signup"
                className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                Create on Story Time
              </Link>
            </motion.div>
          </div>

          <div className="mt-10 w-full min-w-0 sm:mt-12 lg:mt-14">
            <LandingSpotlightSlider variant="hero" />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
