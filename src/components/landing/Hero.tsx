"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Clapperboard, Play, Sparkles } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import { LandingSpotlightSlider } from "@/components/landing/LandingSpotlightSlider";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-x-hidden px-4 pb-10 pt-[4.5rem] sm:px-6 sm:pb-12 sm:pt-24 lg:min-h-[92svh] lg:overflow-hidden lg:pb-12 lg:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(255,170,51,0.14),transparent_42%),linear-gradient(180deg,rgba(5,8,14,0.15),rgba(5,8,14,0.92))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,14,0.35),rgba(5,8,14,0.88))] lg:bg-[linear-gradient(90deg,rgba(5,8,14,0.96),rgba(5,8,14,0.72)_40%,rgba(5,8,14,0.78))]" />

      {/* Mobile: poster wall + atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,140,50,0.2),transparent_50%)]" />
        <motion.div
          animate={{ opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/2 top-[28%] h-56 w-56 -translate-x-1/2 rounded-full bg-orange-500/20 blur-[90px] sm:h-72 sm:w-72"
        />
        {[
          {
            src: "/posters/poster-1.svg",
            className: "left-[4%] top-[6%] w-[46%] -rotate-[11deg]",
            drift: { y: [0, -14, 0], rotate: [-11, -8, -11] },
            duration: 11,
          },
          {
            src: "/posters/poster-2.svg",
            className: "right-[2%] top-[12%] w-[44%] rotate-[9deg]",
            drift: { y: [0, 12, 0], rotate: [9, 12, 9] },
            duration: 13,
          },
          {
            src: "/posters/poster-3.svg",
            className: "left-[22%] top-[32%] w-[40%] rotate-[4deg]",
            drift: { y: [0, -10, 0], rotate: [4, 7, 4] },
            duration: 9,
          },
          {
            src: "/posters/poster-2.svg",
            className: "right-[14%] top-[38%] w-[32%] -rotate-[6deg] opacity-80",
            drift: { y: [0, 8, 0], rotate: [-6, -3, -6] },
            duration: 12,
          },
        ].map((poster, index) => (
          <motion.div
            key={`${poster.src}-${index}`}
            animate={poster.drift}
            transition={{ duration: poster.duration, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute overflow-hidden rounded-[1.15rem] border border-white/[0.08] shadow-[0_28px_90px_-36px_rgba(0,0,0,0.95)] ${poster.className}`}
          >
            <Image src={poster.src} alt="" width={300} height={450} className="h-auto w-full saturate-[1.08] contrast-[1.05]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#05080e]/70" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
          </motion.div>
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,14,0.55)_0%,rgba(5,8,14,0.2)_38%,rgba(5,8,14,0.88)_72%,#05080e_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[3px] bg-black/70" />
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/70" />
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
        <motion.div
          animate={{ x: ["-40%", "140%"] }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          className="absolute top-[44%] h-px w-1/2 bg-gradient-to-r from-transparent via-orange-300/35 to-transparent"
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
        <LandingReveal className="max-w-3xl lg:max-w-3xl">
          {/* Mobile / tablet: poster-led intro */}
          <div className="relative flex min-h-[calc(100svh-4.5rem)] w-full flex-col justify-end overflow-visible pb-6 pt-[42vh] text-center lg:hidden">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-sm px-3"
            >
              <div
                className="pointer-events-none absolute -left-3 top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-transparent via-orange-400/80 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -right-3 top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-transparent via-orange-400/80 to-transparent"
                aria-hidden
              />
              <h1 className="font-display text-[1.5rem] font-semibold leading-snug tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.55)] sm:text-[1.7rem]">
                Be The Authority
              </h1>
              <div className="mx-auto mt-3 flex items-center justify-center gap-2" aria-hidden>
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-orange-400/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.9)]" />
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-orange-400/60" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-7 w-full max-w-[15.5rem] sm:max-w-[17rem]"
            >
              <Link
                href="/auth/signin"
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-orange-400/30 bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_-12px_rgba(249,115,22,0.8)] transition active:scale-[0.98]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-orange-400/0 via-white/15 to-orange-400/0 opacity-0 transition group-active:opacity-100" />
                <Play className="relative h-4 w-4 fill-white" />
                <span className="relative">Enter Platform</span>
              </Link>
            </motion.div>

            <div className="mx-auto mt-8 w-full max-w-lg px-1">
              <LandingSpotlightSlider />
            </div>
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
                className="group flex items-center gap-2 rounded-2xl bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400"
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
