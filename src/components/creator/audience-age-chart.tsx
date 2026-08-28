"use client";

import type { AgeDistributionRow } from "@/lib/creator-audience-insights";

export function AudienceAgeChart({
  rows,
  title,
  emptyMessage = "Not enough viewer data in this window yet.",
}: {
  rows: AgeDistributionRow[];
  title?: string;
  emptyMessage?: string;
}) {
  const active = rows.filter((r) => r.bracket !== "Unknown" && r.viewers > 0);
  const maxViewers = Math.max(1, ...active.map((r) => r.viewers));
  const totalKnown = active.reduce((sum, r) => sum + r.viewers, 0);

  if (totalKnown === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4">
        {title ? <p className="mb-2 text-sm font-medium text-white">{title}</p> : null}
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-slate-950/30 p-4 space-y-3">
      {title ? <p className="text-sm font-medium text-white">{title}</p> : null}
      <div className="space-y-2">
        {active.map((row) => (
          <div key={row.bracket} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2">
            <span className="text-[11px] text-slate-400">{row.bracket}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-violet-500"
                style={{ width: `${Math.max(4, Math.round((row.viewers / maxViewers) * 100))}%` }}
                title={`${row.viewers} viewers (${row.pct}%)`}
              />
            </div>
            <span className="text-right text-[11px] text-slate-300">
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
      {rows.find((r) => r.bracket === "Unknown" && r.viewers > 0) ? (
        <p className="text-[11px] text-slate-500">
          {rows.find((r) => r.bracket === "Unknown")?.viewers ?? 0} viewer
          {(rows.find((r) => r.bracket === "Unknown")?.viewers ?? 0) === 1 ? "" : "s"} without profile age data
        </p>
      ) : null}
    </div>
  );
}
