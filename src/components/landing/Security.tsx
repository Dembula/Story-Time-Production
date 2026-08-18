import { Shield } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

export function Security() {
  const items = [
    "Authenticated accounts",
    "Role-based access",
    "Age-aware profiles",
    "Admin review",
  ];

  return (
    <section className="border-t border-white/8 px-3 py-14 sm:px-6 sm:py-20">
      <LandingReveal className="mx-auto w-full max-w-6xl text-center">
        <Shield className="mx-auto mb-5 h-11 w-11 text-orange-300 sm:mb-6 sm:h-12 sm:w-12" />
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-orange-300/75">
          Built with care
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Secure by default
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300/80 sm:text-base">
          Story Time protects access, audience trust, and publishing integrity with controlled accounts,
          moderation workflows, and age-aware viewing rules.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-2.5 sm:mt-10 sm:grid-cols-4 sm:gap-4">
          {items.map((item) => (
            <div
              key={item}
              className="storytime-panel rounded-xl border border-orange-400/10 px-2.5 py-2.5 text-[11px] font-medium leading-snug text-slate-200 transition hover:-translate-y-0.5 hover:border-orange-300/25 sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm"
            >
              {item}
            </div>
          ))}
        </div>
      </LandingReveal>
    </section>
  );
}
