"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import type { ExecutiveKpi } from "@/lib/executive/types";

type KpiStripProps = {
  kpis: ExecutiveKpi[];
  className?: string;
};

const toneValueClass: Record<NonNullable<ExecutiveKpi["tone"]>, string> = {
  neutral: "text-white",
  good: "text-emerald-300",
  warn: "text-amber-300",
  bad: "text-red-300",
};

const toneGlowClass: Record<NonNullable<ExecutiveKpi["tone"]>, string> = {
  neutral: "from-slate-500/10",
  good: "from-emerald-500/15",
  warn: "from-amber-500/15",
  bad: "from-red-500/15",
};

function formatKpiValue(kpi: ExecutiveKpi): string {
  if (typeof kpi.value === "number") {
    if (kpi.unit === "ZAR") return formatZar(kpi.value);
    if (kpi.unit === "%") return `${kpi.value.toFixed(1)}%`;
    if (kpi.unit === "ms") return `${Math.round(kpi.value)} ms`;
    return kpi.value.toLocaleString("en-ZA");
  }
  return String(kpi.value);
}

function DeltaBadge({ deltaPct }: { deltaPct: number }) {
  const positive = deltaPct > 0;
  const negative = deltaPct < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const color = positive ? "text-emerald-400" : negative ? "text-red-400" : "text-slate-500";

  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${color}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

export function KpiStrip({ kpis, className = "" }: KpiStripProps) {
  if (kpis.length === 0) return null;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`.trim()}>
      {kpis.map((kpi) => {
        const tone = kpi.tone ?? "neutral";
        return (
          <div
            key={kpi.id}
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${toneGlowClass[tone]} to-slate-950/80 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.25)]`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{kpi.label}</p>
              {kpi.deltaPct != null ? <DeltaBadge deltaPct={kpi.deltaPct} /> : null}
            </div>
            <p className={`font-display text-[1.7rem] font-semibold tabular-nums tracking-tight ${toneValueClass[tone]}`}>
              {formatKpiValue(kpi)}
              {kpi.unit && kpi.unit !== "ZAR" && kpi.unit !== "%" && kpi.unit !== "ms" ? (
                <span className="ml-1 text-sm font-normal text-slate-400">{kpi.unit}</span>
              ) : null}
            </p>
            <p className="mt-2 text-[10px] text-slate-500">
              {kpi.freshness.label}
              {kpi.sourcePending ? " · source pending" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
