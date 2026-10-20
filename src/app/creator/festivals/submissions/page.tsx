"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import {
  FestivalBrowseShell,
  FestivalEmptyState,
  FestivalHeroBanner,
} from "@/components/creator/festival-browse-ui";

export default function CreatorFestivalSubmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["creator-festival-submissions"],
    queryFn: () => fetch("/api/creator/festivals/submissions").then((r) => r.json()),
  });

  const rows = data?.submissions ?? [];

  return (
    <FestivalBrowseShell>
      <FestivalHeroBanner
        title="My submissions"
        subtitle="Payment and selection status across festivals."
        actions={
          <Link
            href="/creator/festivals"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-orange-400"
          >
            Browse festivals <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <FestivalEmptyState
          title="No submissions yet"
          body="Browse open festivals and submit your film through Story Time."
          href="/creator/festivals"
          actionLabel="Browse festivals"
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((s: {
            id: string;
            title: string;
            paymentStatus: string;
            selectionStatus: string;
            feeAmountZar: number;
            festival?: { id: string; name: string; status: string; headerImageUrl?: string | null };
            category?: { name: string };
          }) => (
            <li
              key={s.id}
              className="cinematic-glass overflow-hidden rounded-2xl border border-white/8 shadow-panel"
            >
              <div className="flex flex-col sm:flex-row">
                <div className="relative h-28 w-full shrink-0 bg-slate-900 sm:h-auto sm:w-40">
                  {s.festival?.headerImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.festival.headerImageUrl}
                      alt=""
                      className="h-full w-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="flex h-full min-h-[7rem] items-center justify-center bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.2),_transparent_60%)]" />
                  )}
                </div>
                <div className="flex flex-1 flex-wrap items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-lg font-semibold text-white">{s.title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {s.festival?.name}
                      {s.category?.name ? ` · ${s.category.name}` : ""}
                    </p>
                    {s.festival?.id ? (
                      <Link
                        href={`/creator/festivals/${s.festival.id}`}
                        className="mt-2 inline-block text-xs font-medium text-orange-200 hover:text-orange-100"
                      >
                        View festival
                      </Link>
                    ) : null}
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-sm font-semibold text-orange-200">
                      R{Number(s.feeAmountZar).toFixed(2)}
                    </p>
                    <p className="mt-1 text-slate-400">{s.paymentStatus}</p>
                    <p className="mt-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-slate-300">
                      {s.selectionStatus.replace(/_/g, " ")}
                    </p>
                    {s.festival?.status === "ENDED" ? (
                      <p className="mt-1 text-slate-600">Festival ended</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </FestivalBrowseShell>
  );
}
