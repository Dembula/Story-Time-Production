import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

type OpsMetricCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: "orange" | "emerald" | "cyan" | "violet" | "amber";
  className?: string;
};

const accentMap = {
  orange: "border-l-orange-500/60",
  emerald: "border-l-emerald-500/60",
  cyan: "border-l-cyan-500/60",
  violet: "border-l-violet-500/60",
  amber: "border-l-amber-500/60",
};

export function OpsMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "orange",
  className = "",
}: OpsMetricCardProps) {
  return (
    <div
      className={`cinematic-glass rounded-2xl border border-white/8 border-l-4 ${accentMap[accent]} p-4 shadow-panel ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-orange-300/80" /> : null}
      </div>
      <p className="font-display text-2xl font-semibold tracking-tight text-white">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

export function OpsPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="text-sm leading-relaxed text-slate-400 md:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function OpsSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function OpsRangeTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === opt.value
              ? "bg-orange-500 text-white shadow-glow"
              : "border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function OpsQuickActions({ items }: { items: { href: string; label: string; description?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-orange-400/25 hover:bg-white/[0.06]"
        >
          <p className="text-sm font-semibold text-white group-hover:text-orange-100">{item.label}</p>
          {item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}
        </Link>
      ))}
    </div>
  );
}
