"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Film, Sparkles, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminReviewHubClient() {
  const { data: content, isLoading: loadingContent } = useQuery({
    queryKey: ["admin-content-review-hub"],
    queryFn: () => fetch("/api/admin/content?status=ALL").then((r) => r.json()),
  });
  const { data: pitches, isLoading: loadingPitches } = useQuery({
    queryKey: ["admin-originals-pitches-hub"],
    queryFn: () => fetch("/api/originals?type=pitches").then((r) => r.json()),
  });

  const list = Array.isArray(content) ? content : [];
  const pitchList = Array.isArray(pitches) ? pitches : [];

  const pendingCatalogue = list.filter((c: { reviewStatus: string }) => c.reviewStatus === "PENDING").length;
  const changesCatalogue = list.filter((c: { reviewStatus: string }) => c.reviewStatus === "CHANGES_REQUESTED").length;

  const pendingOriginals = pitchList.filter((p: { status: string }) =>
    ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(p.status),
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Operations</p>
        <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <ClipboardList className="h-8 w-8 text-orange-500" />
          Review hub
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          One place to see what needs attention. Open the full queues for catalogue titles vs Originals pitch packages.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/admin/content"
          className="creator-glass-panel group flex flex-col gap-3 rounded-2xl border border-white/10 p-5 transition hover:border-orange-400/30"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white">
              <Film className="h-5 w-5 text-orange-400" />
              <span className="font-semibold">Catalogue (films &amp; series)</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-orange-300" />
          </div>
          {loadingContent ? (
            <Skeleton className="h-16 bg-white/[0.06]" />
          ) : (
            <ul className="space-y-1 text-xs text-slate-400">
              <li>
                <span className="text-slate-200">{pendingCatalogue}</span> pending review
              </li>
              <li>
                <span className="text-slate-200">{changesCatalogue}</span> awaiting creator resubmission
              </li>
              <li>
                <span className="text-slate-200">{list.length}</span> total loaded (current tab fetch)
              </li>
            </ul>
          )}
        </Link>

        <Link
          href="/admin/originals"
          className="creator-glass-panel group flex flex-col gap-3 rounded-2xl border border-white/10 p-5 transition hover:border-orange-400/30"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-orange-400" />
              <span className="font-semibold">Story Time Originals</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:text-orange-300" />
          </div>
          {loadingPitches ? (
            <Skeleton className="h-16 bg-white/[0.06]" />
          ) : (
            <ul className="space-y-1 text-xs text-slate-400">
              <li>
                <span className="text-slate-200">{pendingOriginals}</span> pitches in inbox / review / changes
              </li>
              <li>
                <span className="text-slate-200">{pitchList.length}</span> total pitches
              </li>
            </ul>
          )}
        </Link>
      </div>

      <section className="creator-glass-panel rounded-2xl border border-white/10 p-5 text-xs text-slate-500">
        <p className="font-medium text-slate-300">Workflow</p>
        <p className="mt-2 leading-relaxed">
          Catalogue decisions notify the title owner and can include deep-links back into the app. Originals decisions
          notify the pitch creator. Competition go-live sends role-specific alerts from the Competition admin page.
        </p>
      </section>
    </div>
  );
}
