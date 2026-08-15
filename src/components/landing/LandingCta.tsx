import Link from "next/link";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function LandingCta() {
  return (
    <section className="border-t border-white/8 px-4 py-12 sm:px-6 sm:py-16">
      <LandingReveal className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Create. Release. Own it.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Tools for filmmakers and storytellers — and a home for audiences who want independent work.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/auth/creator/signup"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/92"
          >
            Start creating
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-xl border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            Watch stories
          </Link>
        </div>
      </LandingReveal>
    </section>
  );
}
