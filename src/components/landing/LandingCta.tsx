import Link from "next/link";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingCta() {
  return (
    <section className="border-t border-white/8 bg-white/[0.02] px-3 py-10 sm:px-6 sm:py-20">
      <LandingReveal className="mx-auto w-full max-w-6xl text-center">
        <div className="storytime-section relative overflow-hidden rounded-2xl border border-orange-400/15 px-4 py-9 sm:rounded-[1.75rem] sm:px-8 sm:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,173,71,0.16),transparent_38%)]" />
          <div className="relative">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.28em] text-orange-300/80">
              Create. Release. Own it.
            </p>
            <h2 className="mb-3 font-display text-2xl font-bold tracking-tight text-white sm:mb-4 sm:text-3xl md:text-5xl">
              Build what outlives the moment.
            </h2>
            <p className="mx-auto mb-8 w-full text-base leading-7 text-slate-300/80 sm:mb-10 sm:max-w-3xl sm:text-lg sm:leading-8">
              Tools for filmmakers and storytellers — and a home for audiences who want independent work.
              Shape culture, protect your catalogue, and take part in the future of storytelling.
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <Link
                href="/auth/creator/signup"
                className="rounded-2xl viewer-btn-primary px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5 sm:px-8 sm:py-3.5 sm:text-base"
              >
                Start creating
              </Link>
              <Link
                href="/auth/signup"
                className="storytime-panel rounded-2xl border border-orange-400/20 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-orange-300/35 hover:bg-orange-500/10 sm:px-8 sm:py-3.5 sm:text-base"
              >
                Watch stories
              </Link>
            </div>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
