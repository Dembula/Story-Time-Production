import Link from "next/link";
import type { ReactNode } from "react";
import { Clapperboard, Film } from "lucide-react";

export function FestivalBrowseShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-6xl space-y-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl"
      />
      <div className="relative space-y-8">{children}</div>
    </div>
  );
}

export function FestivalHeroBanner({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 shadow-panel md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.22),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(251,191,36,0.08),_transparent_45%)]"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">
            <Film className="h-3.5 w-3.5" />
            Story Time Festivals
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-300 md:text-base">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function FestivalEmptyState({
  title,
  body,
  href,
  actionLabel,
}: {
  title: string;
  body?: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="cinematic-glass flex flex-col items-center justify-center rounded-3xl border border-white/8 px-6 py-16 text-center shadow-panel">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10">
        <Clapperboard className="h-6 w-6 text-orange-300" />
      </div>
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {body ? <p className="mt-2 max-w-md text-sm text-slate-400">{body}</p> : null}
      {href && actionLabel ? (
        <Link
          href={href}
          className="mt-5 rounded-xl bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function festivalFieldClassName() {
  return "mt-1.5 h-12 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/15";
}

export function festivalTextareaClassName() {
  return "mt-1.5 w-full rounded-xl border border-white/12 bg-black/40 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/15";
}
