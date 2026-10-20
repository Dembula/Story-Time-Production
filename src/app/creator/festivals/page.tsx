"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Layers, Ticket } from "lucide-react";
import {
  FestivalBrowseShell,
  FestivalEmptyState,
  FestivalHeroBanner,
} from "@/components/creator/festival-browse-ui";

type FestivalCard = {
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
  currentTier?: string;
};

export default function CreatorFestivalsPage() {
  const [openOnly, setOpenOnly] = useState(true);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["creator-festivals"],
    queryFn: () => fetch("/api/creator/festivals").then((r) => r.json()),
  });

  const festivals = useMemo(() => {
    let rows = (data?.festivals ?? []) as FestivalCard[];
    if (openOnly) rows = rows.filter((f) => f.acceptingSubmissions);
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((f) =>
        [f.name, f.tagline, f.about].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [data?.festivals, openOnly, q]);

  return (
    <FestivalBrowseShell>
      <FestivalHeroBanner
        title="Browse festivals"
        subtitle="Find open calls, compare fees, and submit through Story Time."
        actions={
          <Link
            href="/creator/festivals/submissions"
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-orange-400/40 hover:bg-orange-500/10"
          >
            My submissions
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search festivals…"
          className="h-11 min-w-[16rem] flex-1 rounded-xl border border-white/12 bg-black/35 px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/15"
        />
        <button
          type="button"
          onClick={() => setOpenOnly((v) => !v)}
          className={`h-11 rounded-xl px-4 text-sm font-medium transition ${
            openOnly
              ? "bg-orange-500/90 text-slate-950"
              : "border border-white/12 text-slate-300 hover:border-white/25"
          }`}
        >
          {openOnly ? "Open calls" : "All festivals"}
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-white/8 bg-white/[0.03]" />
          ))}
        </div>
      ) : festivals.length === 0 ? (
        <FestivalEmptyState
          title="No festivals match"
          body="Try showing all festivals, or check back when new open calls go live."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {festivals.map((f) => (
            <Link
              key={f.id}
              href={`/creator/festivals/${f.id}`}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-panel transition hover:border-orange-400/35 hover:shadow-[0_0_48px_-20px_rgba(249,115,22,0.55)]"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
                {f.headerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.headerImageUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(249,115,22,0.25),_transparent_55%)]">
                    <FilmMark />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                <div className="absolute left-4 top-4">
                  {f.acceptingSubmissions ? (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/30">
                      Open
                    </span>
                  ) : (
                    <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-white/15">
                      {f.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {f.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.logoUrl}
                    alt=""
                    className="absolute bottom-4 left-4 h-14 w-14 rounded-2xl border border-white/25 object-cover shadow-xl"
                  />
                ) : null}
              </div>
              <div className="space-y-3 p-5">
                <div>
                  <h2 className="font-display text-xl font-semibold text-white group-hover:text-orange-50">
                    {f.name}
                  </h2>
                  {f.tagline ? <p className="mt-1 text-sm text-slate-400">{f.tagline}</p> : null}
                </div>
                {f.about ? <p className="line-clamp-2 text-sm text-slate-500">{f.about}</p> : null}
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5 text-orange-300/80" />
                    {f.fromFeeZar != null ? `From R${Number(f.fromFeeZar).toFixed(0)}` : "Fees TBA"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-orange-300/80" />
                    {f.categoryCount} categories
                  </span>
                  {f.eventStartsAt ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-orange-300/80" />
                      {new Date(f.eventStartsAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between pt-1 text-sm font-medium text-orange-200">
                  <span>View festival</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </FestivalBrowseShell>
  );
}

function FilmMark() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
      <span className="font-display text-lg font-semibold text-orange-200">ST</span>
    </div>
  );
}
