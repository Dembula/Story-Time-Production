 "use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Play, Sparkles } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function Hero() {
  return (
    <section className="relative flex min-h-[92svh] items-center overflow-hidden px-4 pb-10 pt-20 sm:min-h-screen sm:px-6 sm:pb-12 sm:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,170,51,0.12),transparent_26%),linear-gradient(180deg,rgba(5,8,14,0.24),rgba(5,8,14,0.72))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,14,0.96),rgba(5,8,14,0.72)_40%,rgba(5,8,14,0.78))]" />
      <div className="absolute inset-y-0 left-1/2 hidden w-[44rem] -translate-x-1/2 lg:block">
        <motion.div
          initial={{ opacity: 0.4, scale: 0.96 }}
          animate={{ opacity: 0.6, scale: 1.02 }}
          transition={{ duration: 6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          className="absolute left-1/2 top-1/2 h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-3xl"
        />
        {[
          { src: "/public/posters/poster-1.svg", fallback: "/posters/poster-1.svg" },
          { src: "/public/posters/poster-2.svg", fallback: "/posters/poster-2.svg" },
          { src: "/public/posters/poster-3.svg", fallback: "/posters/poster-3.svg" },
        ].map((poster, index) => (
          <motion.div
            key={poster.fallback}
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.8, delay: 0.2 + index * 0.15 },
              y: { duration: 7 + index, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
            }}
            className={[
              "absolute overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] shadow-[0_30px_90px_-40px_rgba(0,0,0,0.92)] backdrop-blur-xl",
              index === 0 ? "right-[16%] top-[10%] w-56 rotate-[10deg]" : "",
              index === 1 ? "left-[6%] top-[26%] w-64 -rotate-[9deg]" : "",
              index === 2 ? "right-[10%] bottom-[10%] w-60 rotate-[5deg]" : "",
            ].join(" ")}
          >
            <Image
              src={poster.fallback}
              alt=""
              width={320}
              height={480}
              className="h-auto w-full opacity-90"
              priority={index === 0}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(5,8,14,0.45))]" />
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[14%] left-[18%] h-px w-52 bg-gradient-to-r from-transparent via-orange-300 to-transparent"
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 sm:gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <LandingReveal className="max-w-3xl">
          <div className="storytime-panel mb-6 inline-flex items-center gap-3 rounded-full px-4 py-2 text-[0.68rem] sm:mb-8 sm:px-5 sm:py-2.5 sm:text-[0.78rem] font-medium uppercase tracking-[0.18em] sm:tracking-[0.22em] text-slate-200/92">
            <span className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_14px_rgba(255,179,71,0.75)]" />
            Creator-owned streaming infrastructure
          </div>
          <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:gap-4">
            <Image src="/logo.png" alt="Story Time" width={72} height={72} className="rounded-[1.2rem] shadow-glow sm:h-[88px] sm:w-[88px] sm:rounded-[1.4rem]" />
            <div>
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.28em] text-slate-400">Story Time</p>
              <p className="text-sm sm:text-base text-orange-200/85">Built for stories that deserve to endure</p>
            </div>
          </div>
          <h1 className="mb-4 font-display text-4xl font-bold tracking-tight text-white sm:mb-5 sm:text-5xl md:text-7xl">
            Where Stories Become Legacy.
          </h1>
          <p className="mb-3 text-lg sm:text-xl font-light tracking-wide text-orange-200/90 md:text-2xl">
            Create, release, and shape your work on your own terms.
          </p>
          <p className="mb-8 max-w-2xl text-base leading-7 text-slate-300/88 sm:mb-10 sm:text-lg sm:leading-8">
            Story Time is a creator-powered ecosystem for filmmakers, writers, musicians, and production teams to develop work, share it with the world, and build a body of work that remains in their hands.
          </p>
          <div className="mb-7 flex flex-wrap gap-3 sm:mb-8 sm:gap-4">
            <Link href="/auth/signup" className="group flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 sm:px-8 sm:py-3.5 sm:text-base">
              <Play className="w-5 h-5" />
              Enter Platform
            </Link>
            <Link href="#features" className="storytime-panel flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-white/[0.04] sm:px-8 sm:py-3.5 sm:text-base">
              <ArrowRight className="w-5 h-5" />
              Explore Features
            </Link>
          </div>
          <div className="inline-flex items-center gap-3 sm:gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-slate-300/88 shadow-panel">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1">
                <span className="w-1.5 rounded-full bg-orange-300/80 animate-[pulse_1.2s_ease-in-out_infinite]" style={{ height: "14px" }} />
                <span className="w-1.5 rounded-full bg-orange-300/70 animate-[pulse_1.2s_ease-in-out_0.18s_infinite]" style={{ height: "20px" }} />
                <span className="w-1.5 rounded-full bg-orange-300 animate-[pulse_1.2s_ease-in-out_0.36s_infinite]" style={{ height: "26px" }} />
              </div>
              <span>Opening a new era for storytellers</span>
            </div>
          </div>
        </LandingReveal>

        <LandingReveal delay={0.12} className="lg:justify-self-end">
          <div className="storytime-section relative overflow-hidden p-4 sm:p-6 md:p-7">
            <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,186,93,0.16),transparent)]" />
            <div className="relative">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live ecosystem</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-white">From first idea to lasting presence</h2>
                </div>
                <Sparkles className="h-5 w-5 text-orange-300" />
              </div>
              <div className="space-y-3">
                {[
                  { icon: Clapperboard, title: "Shape the work", text: "Write, plan, refine, and produce inside one environment designed to keep the creative process connected." },
                  { icon: Play, title: "Release without friction", text: "Bring films, series, shows, podcasts, and music to audiences through a platform built for creator-led distribution." },
                  { icon: ArrowRight, title: "Grow with clarity", text: "Understand how your work moves through the world, how audiences respond, and how your presence deepens over time." },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.15 * index }}
                    className="storytime-panel flex items-start gap-4 rounded-2xl p-4"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-400/16 bg-orange-500/10">
                      <item.icon className="h-5 w-5 text-orange-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300/75">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
