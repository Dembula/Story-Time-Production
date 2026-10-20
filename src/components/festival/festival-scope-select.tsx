"use client";

import Link from "next/link";
import type { FestivalListItem } from "@/components/festival/use-active-festival";

export function FestivalScopeSelect({
  festivals,
  value,
  onChange,
  isLoading,
  className = "",
}: {
  festivals: FestivalListItem[];
  value: string;
  onChange: (id: string) => void;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div
        className={`h-11 min-w-[16rem] max-w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04] ${className}`}
      />
    );
  }

  if (festivals.length === 0) {
    return (
      <div
        className={`flex min-h-11 min-w-[16rem] max-w-full flex-wrap items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-2.5 ${className}`}
      >
        <span className="text-sm text-slate-400">No festivals yet</span>
        <Link
          href="/festival/festivals"
          className="rounded-lg bg-orange-500/90 px-3 py-1.5 text-xs font-semibold text-slate-950"
        >
          Create one
        </Link>
      </div>
    );
  }

  return (
    <label className={`flex min-w-[16rem] max-w-full flex-col gap-1.5 sm:max-w-md ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Festival</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-[16rem] appearance-none rounded-xl border border-white/12 bg-slate-950 bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3 pr-10 text-sm text-white shadow-sm outline-none transition focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%94a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")",
        }}
      >
        {festivals.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}
