"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function FestivalDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = data?.festivals ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">Festival dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Free curator access — track your submission revenue and filmmaker receipts under Revenue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/festival/payouts"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-500/40 hover:text-amber-100"
          >
            Revenue
          </Link>
          <Link
            href="/festival/festivals"
            className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Manage festivals
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : festivals.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8">
          <h2 className="text-lg font-semibold text-white">Create your first festival</h2>
          <p className="mt-2 text-sm text-slate-400">
            Set up your listing, categories, and fees at no subscription cost. You earn from paid submissions.
          </p>
          <Link
            href="/festival/festivals"
            className="mt-4 inline-flex rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
          >
            Get started
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {festivals.map((f: {
            id: string;
            name: string;
            status: string;
            acceptingSubmissions: boolean;
            _count?: { submissions: number; memberships: number };
          }) => (
            <Link
              key={f.id}
              href={`/festival/festivals/${f.id}`}
              className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950 p-5 transition hover:border-amber-500/30"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">{f.name}</h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                  {f.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                {f._count?.submissions ?? 0} paid submissions · {f._count?.memberships ?? 0} team
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {f.acceptingSubmissions ? "Accepting submissions" : "Submissions closed"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
