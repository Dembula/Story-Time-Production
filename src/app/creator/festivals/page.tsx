"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export default function CreatorFestivalsPage() {
  const [openOnly, setOpenOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festivals"],
    queryFn: () => fetch("/api/creator/festivals").then((r) => r.json()),
  });

  const festivals = useMemo(() => {
    const rows = data?.festivals ?? [];
    if (!openOnly) return rows;
    return rows.filter((f: { acceptingSubmissions: boolean }) => f.acceptingSubmissions);
  }, [data?.festivals, openOnly]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Film festivals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Discover festivals promoting on Story Time — fees, deadlines, and submissions in one place.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open for submissions
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading festivals…</p>
      ) : festivals.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 p-8 text-sm text-slate-500">
          No festivals are listed yet. Check back soon.
        </p>
      ) : (
        <div className="grid gap-4">
          {festivals.map((f: {
            id: string;
            name: string;
            tagline?: string | null;
            about?: string | null;
            headerImageUrl?: string | null;
            logoUrl?: string | null;
            yearsRunning: number;
            fromFeeZar: number | null;
            acceptingSubmissions: boolean;
            status: string;
            eventStartsAt?: string | null;
            categoryCount: number;
          }) => (
            <Link
              key={f.id}
              href={`/creator/festivals/${f.id}`}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 transition hover:border-amber-500/35"
            >
              <div className="relative aspect-[21/7] bg-slate-900">
                {f.headerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.headerImageUrl} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-95" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-slate-600">
                    Festival
                  </div>
                )}
                {f.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.logoUrl}
                    alt=""
                    className="absolute bottom-3 left-4 h-14 w-14 rounded-xl border border-white/20 object-cover shadow-lg"
                  />
                ) : null}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{f.name}</h2>
                    {f.tagline ? <p className="text-sm text-slate-400">{f.tagline}</p> : null}
                  </div>
                  <div className="text-right text-xs">
                    {f.acceptingSubmissions ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">Open</span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">{f.status.replace(/_/g, " ")}</span>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-slate-500">{f.about}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{f.yearsRunning} years running</span>
                  <span>{f.categoryCount} categories</span>
                  {f.fromFeeZar != null ? <span className="text-amber-200/90">From R{Number(f.fromFeeZar).toFixed(0)}</span> : null}
                  {f.eventStartsAt ? <span>Event {new Date(f.eventStartsAt).toLocaleDateString()}</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
