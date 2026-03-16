import Link from "next/link";
import Image from "next/image";
import { Film, Play, Lock } from "lucide-react";

export function Hero() {
  return (
    <section className="min-h-screen flex items-center px-6 pt-24 pb-12 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-3xl" />
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/50 bg-slate-800/40 text-sm text-slate-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          South Africa&apos;s Creator-First Streaming Platform
        </div>
        <Image src="/logo.png" alt="Story Time" width={72} height={72} className="mx-auto mb-6 rounded-xl" />
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
          STORY TIME
        </h1>
        <p className="text-xl md:text-2xl text-slate-400 mb-2 font-light">Home of Independent Creators</p>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          The streaming platform built by creators, for creators. Discover movies, series, shows, podcasts, and music from South Africa and beyond.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <Link href="/auth/signup" className="group px-8 py-3.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition shadow-lg shadow-orange-500/20 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Start 3-Day Free Trial
          </Link>
          <Link href="/auth/creator/signup" className="px-8 py-3.5 rounded-xl border border-slate-600 text-white font-semibold hover:bg-slate-800/50 transition flex items-center gap-2">
            <Film className="w-5 h-5" />
            Become a Creator
          </Link>
        </div>
      </div>
    </section>
  );
}
