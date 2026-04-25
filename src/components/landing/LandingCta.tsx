import Link from "next/link";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingCta() {
  return (
    <section className="border-t border-white/8 bg-white/[0.02] px-4 py-14 sm:px-6 sm:py-20">
      <LandingReveal className="mx-auto max-w-4xl text-center">
        <div className="storytime-section relative overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,173,71,0.14),transparent_34%)]" />
          <div className="relative">
            <h2 className="mb-3 sm:mb-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white md:text-5xl">
              Build what outlives the moment.
            </h2>
            <p className="mx-auto mb-8 sm:mb-10 max-w-3xl text-base sm:text-lg leading-7 sm:leading-8 text-slate-300/80">
              Story Time is for creators who want more than exposure. It is for those who want to shape culture, protect their work, and take part in building the future architecture of storytelling itself.
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <Link href="/auth/creator/signup" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm sm:px-8 sm:py-3.5 sm:text-base font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
                Start Building
              </Link>
              <Link href="/auth/signup" className="storytime-panel rounded-2xl px-6 py-3 text-sm sm:px-8 sm:py-3.5 sm:text-base font-semibold text-white hover:-translate-y-0.5 hover:bg-white/[0.04]">
                Enter Platform
              </Link>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
