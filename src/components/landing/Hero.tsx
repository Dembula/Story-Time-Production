"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSpotlightSlider } from "@/components/landing/LandingSpotlightSlider";

export function Hero() {
  return (
    <section className="relative overflow-x-clip px-4 pb-8 pt-[4.75rem] sm:px-6 sm:pb-12 sm:pt-24 lg:pb-16 lg:pt-28">
      {/* Quiet cinematic field — no poster collage, no orange orbs */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,#0a0a0a_45%,#000_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.04),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl">
        <LandingReveal className="w-full min-w-0">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:max-w-xl lg:items-start lg:text-left">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500"
            >
              Independent streaming
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-3 font-display text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]"
            >
              Stories, on your terms.
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
              className="mt-7 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center"
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
