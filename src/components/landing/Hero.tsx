"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { StoryTimeMark } from "@/components/brand/story-time-mark";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSpotlightSlider } from "@/components/landing/LandingSpotlightSlider";

export function Hero() {
  return (
    <section className="relative overflow-x-clip px-3 pb-10 pt-[4.75rem] sm:px-6 sm:pb-14 sm:pt-24 lg:pb-16 lg:pt-28">
      {/* Black + orange atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,#0a0704_42%,#000_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_48%_at_50%_-8%,rgba(255,140,0,0.18),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_85%_30%,rgba(255,120,40,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black to-transparent" />

      <div className="relative z-10 mx-auto w-full min-w-0 max-w-6xl">
        <LandingReveal className="w-full min-w-0">
          {/* Mobile: transparent ST at full phone width (old hero feel) — no size enlarge */}
          <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 lg:hidden">
            <div className="mx-auto flex w-full flex-col items-center text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mb-1 w-full"
              >
                <StoryTimeMark
                  fullWidth
                  priority
                  className="opacity-95 drop-shadow-[0_16px_48px_rgba(255,140,0,0.32)]"
                />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 }}
                className="mb-1 text-[11px] font-medium uppercase tracking-[0.3em] text-orange-300/80"
              >
                Story Time
              </motion.p>
            </div>
          </div>

          {/* Desktop: professional copy + orange CTAs */}
          <div className="mx-auto hidden max-w-2xl flex-col items-start text-left lg:mx-0 lg:flex lg:max-w-xl">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-orange-300/85"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(255,140,0,0.7)]" />
              Independent streaming
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-4 font-display text-[2.75rem] font-semibold leading-[1.12] tracking-tight text-white xl:text-5xl"
            >
              Stories, on your{" "}
              <span className="storytime-brand-text">terms.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-4 max-w-md text-base leading-relaxed text-slate-300/90"
            >
              Watch creator-owned films and series. Build and release work without the middleman —
              on a platform designed around ownership, craft, and lasting presence.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center gap-2 rounded-2xl viewer-btn-primary px-7 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-current" />
                Enter platform
              </Link>
              <Link
                href="/auth/creator/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-400/25 bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-slate-100 transition hover:-translate-y-0.5 hover:border-orange-300/40 hover:bg-orange-500/10"
              >
                Create on Story Time
                <ArrowRight className="h-4 w-4 text-orange-300" />
              </Link>
            </motion.div>
          </div>

          <div className="mt-8 w-full min-w-0 sm:mt-10 lg:mt-14">
            <LandingSpotlightSlider variant="hero" />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
