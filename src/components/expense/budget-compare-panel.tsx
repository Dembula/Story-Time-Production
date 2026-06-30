"use client";

import { formatZar } from "@/lib/format-currency-zar";
import { categoryLabel } from "@/lib/expense-types";

type CompareRow = {
  key: string;
  budgeted: number;
  actual: number;
  committed?: number;
  remaining: number;
  variance: number;
  pctUsed?: number;
  forecast?: number;
  projectedOverrun?: number;
  health?: string;
};

type BudgetComparePanelProps = {
  rows: CompareRow[];
  overall?: { budgeted: number; actual: number; remaining: number; variance: number };
};

function healthStyles(health?: string) {
  if (health === "over") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (health === "watch") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
}

export function BudgetComparePanel({ rows, overall }: BudgetComparePanelProps) {
  const sorted = [...rows].sort((a, b) => (b.pctUsed ?? 0) - (a.pctUsed ?? 0));

  return (
    <div className="space-y-4">
      {overall && (
        <div className="creator-glass-panel p-4 grid gap-3 md:grid-cols-4 text-center">
          <div>
            <p className="text-[10px] uppercase text-slate-500">Budgeted</p>
            <p className="text-xl font-semibold text-white">{formatZar(overall.budgeted, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Actual</p>
            <p className="text-xl font-semibold text-white">{formatZar(overall.actual, { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Remaining</p>
            <p className={`text-xl font-semibold ${overall.remaining < overall.budgeted * 0.15 ? "text-amber-300" : "text-emerald-300"}`}>
              {formatZar(overall.remaining, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-slate-500">Variance</p>
            <p className={`text-xl font-semibold ${overall.variance < 0 ? "text-red-300" : "text-emerald-300"}`}>
              {formatZar(overall.variance, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((dept) => {
          const pct = dept.pctUsed ?? (dept.budgeted > 0 ? (dept.actual / dept.budgeted) * 100 : 0);
          return (
            <div key={dept.key} className={`rounded-xl border p-3 ${healthStyles(dept.health)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-medium text-sm">{categoryLabel(dept.key)}</span>
                <span className="text-[10px] uppercase tracking-wide opacity-80">
                  {dept.health === "over" ? "Overspending" : dept.health === "watch" ? "Watch carefully" : "Healthy"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/20 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${pct > 100 ? "bg-red-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                <span>Budget {formatZar(dept.budgeted, { maximumFractionDigits: 0 })}</span>
                <span>Spent {formatZar(dept.actual, { maximumFractionDigits: 0 })}</span>
                <span>Committed {formatZar(dept.committed ?? 0, { maximumFractionDigits: 0 })}</span>
                <span>Remaining {formatZar(dept.remaining, { maximumFractionDigits: 0 })}</span>
                <span>{Math.round(pct)}% used</span>
              </div>
              {(dept.projectedOverrun ?? 0) > 0 && (
                <p className="text-[10px] mt-2 opacity-90">Projected overrun: {formatZar(dept.projectedOverrun!, { maximumFractionDigits: 0 })}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
