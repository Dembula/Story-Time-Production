"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Play, Sparkles } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSpotlightSlider } from "@/components/landing/LandingSpotlightSlider";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-x-clip px-4 pb-10 pt-[4.5rem] sm:px-6 sm:pb-12 sm:pt-24 lg:min-h-[92svh] lg:overflow-hidden lg:pb-12 lg:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(255,170,51,0.14),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.92))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35),rgba(0,0,0,0.88))] lg:bg-[linear-gradient(90deg,rgba(0,0,0,0.96),rgba(0,0,0,0.72)_40%,rgba(0,0,0,0.78))]" />

      {/* Mobile: cinematic backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(255,120,40,0.18),transparent_38%),radial-gradient(circle_at_72%_78%,rgba(120,80,255,0.08),transparent_34%)]" />
        <motion.div
          animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.06, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-[42%] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/14 blur-[80px]"
        />
        {[
          { src: "/posters/poster-2.svg", className: "-left-[18%] top-[14%] w-[42%] -rotate-[14deg] opacity-[0.22]" },
          { src: "/posters/poster-1.svg", className: "-right-[16%] top-[22%] w-[38%] rotate-[11deg] opacity-[0.18]" },
          { src: "/posters/poster-3.svg", className: "left-[8%] bottom-[8%] w-[34%] rotate-[6deg] opacity-[0.14]" },
        ].map((poster) => (
          <div
            key={poster.src}
            className={`absolute overflow-hidden rounded-2xl border border-white/[0.06] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)] ${poster.className}`}
          >
            <Image src={poster.src} alt="" width={280} height={420} className="h-auto w-full blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
          </div>
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.75)_100%)]" />
        <div className="absolute inset-x-0 top-[18%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/90 to-transparent" />
        <motion.div
          animate={{ x: ["-30%", "130%"] }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          className="absolute top-[36%] h-px w-[40%] bg-gradient-to-r from-transparent via-orange-300/40 to-transparent"
        />
      </div>

      {/* Desktop: floating posters */}
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
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.45))]" />
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[14%] left-[18%] h-px w-52 bg-gradient-to-r from-transparent via-orange-300 to-transparent"
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full min-w-0 max-w-7xl items-center gap-8 sm:gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <LandingReveal className="w-full min-w-0 max-w-3xl lg:max-w-3xl">
          {/* Mobile / tablet: cinematic intro */}
          <div className="relative mx-auto flex w-full min-w-0 max-w-full flex-col items-center justify-center overflow-x-clip px-1 py-8 text-center sm:px-2 sm:py-10 lg:hidden">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6 text-[10px] font-medium uppercase tracking-[0.32em] text-slate-400/90"
            >
              Story Time
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="mb-8"
            >
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-1 shadow-[0_0_60px_-24px_rgba(255,130,40,0.65)]">
                <Image
                  src="/logo.png"
                  alt="Story Time"
                  width={92}
                  height={92}
                  className="h-[92px] w-[92px] rounded-[1.15rem] sm:h-[100px] sm:w-[100px]"
                  priority
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="w-full min-w-0 max-w-[min(100%,22rem)] sm:max-w-md"
            >
              <h1 className="font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight text-orange-200/90 drop-shadow-[0_4px_24px_rgba(249,115,22,0.22)] xs:text-[2.5rem] sm:text-[3rem]">
                Be The Authority
              </h1>
              <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-orange-400/70 to-transparent sm:w-28" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="mt-5 max-w-[19rem] text-[15px] font-light leading-relaxed text-slate-300/92 sm:max-w-sm sm:text-base"
            >
              <span className="text-slate-500">Your story.</span>{" "}
              <span className="text-slate-200/95">Your platform.</span>{" "}
              <span className="text-orange-200/90">No middleman.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="mt-8 w-full max-w-[17rem] sm:max-w-xs"
            >
              <Link
                href="/auth/signin"
                className="group flex w-full items-center justify-center gap-2.5 rounded-2xl viewer-btn-primary px-6 py-3.5 text-sm font-semibold transition active:scale-[0.98]"
              >
                <Play className="h-5 w-5 fill-white" />
                Enter Platform
              </Link>
            </motion.div>

            <LandingSpotlightSlider />
          </div>

          {/* Desktop: original hero copy and actions */}
          <div className="hidden lg:block">
            <div className="storytime-panel mb-8 inline-flex items-center gap-3 rounded-full px-5 py-2.5 text-[0.78rem] font-medium uppercase tracking-[0.22em] text-slate-200/92">
              <span className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_14px_rgba(255,179,71,0.75)]" />
              Creator-owned streaming infrastructure
            </div>
            <div className="mb-6 flex items-center gap-4">
              <Image src="/logo.png" alt="Story Time" width={88} height={88} className="rounded-[1.4rem] shadow-glow" />
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Story Time</p>
                <p className="text-base text-orange-200/85">Built for stories that deserve to endure</p>
              </div>
            </div>
            <h1 className="mb-5 font-display text-7xl font-bold tracking-tight text-white">Be The Authority.</h1>
            <p className="mb-3 text-xl font-light tracking-wide text-orange-200/90 md:text-2xl">
              Create, release, and shape your work on your own terms.
            </p>
            <p className="mb-10 max-w-2xl text-lg leading-8 text-slate-300/88">
              Story Time is a creator-powered ecosystem for filmmakers, writers, musicians, and production teams to develop work, share it with the world, and build a body of work that remains in their hands.
            </p>
            <div className="mb-8 flex flex-wrap gap-4">
              <Link
                href="/auth/signin"
                className="group flex items-center gap-2 rounded-2xl viewer-btn-primary px-8 py-3.5 text-base font-semibold transition hover:-translate-y-0.5"
              >
                <Play className="h-5 w-5" />
                Enter Platform
              </Link>
              <Link
                href="#features"
                className="storytime-panel flex items-center gap-2 rounded-2xl px-8 py-3.5 text-base font-semibold text-white hover:-translate-y-0.5 hover:bg-white/[0.04]"
              >
                <ArrowRight className="h-5 w-5" />
                Explore Features
              </Link>
            </div>
            <div className="inline-flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300/88 shadow-panel">
              <div className="flex items-center gap-3">
                <div className="flex items-end gap-1">
                  <span
                    className="w-1.5 rounded-full bg-orange-300/80 animate-[pulse_1.2s_ease-in-out_infinite]"
                    style={{ height: "14px" }}
                  />
                  <span
                    className="w-1.5 rounded-full bg-orange-300/70 animate-[pulse_1.2s_ease-in-out_0.18s_infinite]"
                    style={{ height: "20px" }}
                  />
                  <span
                    className="w-1.5 rounded-full bg-orange-300 animate-[pulse_1.2s_ease-in-out_0.36s_infinite]"
                    style={{ height: "26px" }}
                  />
                </div>
                <span>Opening a new era for storytellers</span>
              </div>
            </div>
          </div>
        </LandingReveal>

        <LandingReveal delay={0.12} className="hidden lg:block lg:justify-self-end">
          <div className="storytime-section relative overflow-hidden p-7">
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
                  {
                    icon: Clapperboard,
                    title: "Shape the work",
                    text: "Write, plan, refine, and produce inside one environment designed to keep the creative process connected.",
                  },
                  {
                    icon: Play,
                    title: "Release without friction",
                    text: "Bring films, series, shows, podcasts, and music to audiences through a platform built for creator-led distribution.",
                  },
                  {
                    icon: ArrowRight,
                    title: "Grow with clarity",
                    text: "Understand how your work moves through the world, how audiences respond, and how your presence deepens over time.",
                  },
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
