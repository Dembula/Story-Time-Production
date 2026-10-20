"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export default function FestivalReviewHubPage() {
  const [festivalId, setFestivalId] = useState("");
  const [stage, setStage] = useState("STAGE1");

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });

  const festivals = list?.festivals ?? [];
  const activeId = festivalId || festivals[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["festival-submissions", activeId, stage],
    queryFn: () =>
      fetch(`/api/festival/${activeId}/submissions?stage=${stage}`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const submissions = data?.submissions ?? [];
  const stats = useMemo(() => {
    const a = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "A").length;
    const b = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "B").length;
    const c = submissions.filter((s: { stage1Group?: string }) => s.stage1Group === "C").length;
    const pending = submissions.filter((s: { stage1Group?: string | null }) => !s.stage1Group).length;
    return { a, b, c, pending, total: submissions.length };
  }, [submissions]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Review hub</h1>
        <p className="mt-1 text-sm text-slate-400">
          Two-stage review: Stage 1 assigns A/B/C (pending approval — no reject). Stage 2 decides official selection.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={activeId}
          onChange={(e) => setFestivalId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {festivals.map((f: { id: string; name: string }) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-700 p-0.5">
          {["STAGE1", "STAGE2"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`rounded-md px-3 py-1.5 text-sm ${stage === s ? "bg-white/10 text-white" : "text-slate-400"}`}
            >
              {s === "STAGE1" ? "Stage 1" : "Stage 2"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Total", stats.total],
          ["Group A", stats.a],
          ["Group B", stats.b],
          ["Group C", stats.c],
          ["Ungrouped", stats.pending],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-slate-500">No paid submissions in this view yet.</p>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s: {
            id: string;
            title: string;
            stage1Group?: string | null;
            selectionStatus: string;
            escalateFlag: boolean;
            category?: { name: string };
          }) => (
            <li key={s.id}>
              <Link
                href={`/festival/review/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-4 py-3 transition hover:border-amber-500/30"
              >
                <div>
                  <p className="font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.category?.name}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  {s.stage1Group ? (
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-amber-200">Group {s.stage1Group}</span>
                  ) : (
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">Pending approval</span>
                  )}
                  {s.escalateFlag ? <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-emerald-300">Escalated</span> : null}
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">{s.selectionStatus.replace(/_/g, " ")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
