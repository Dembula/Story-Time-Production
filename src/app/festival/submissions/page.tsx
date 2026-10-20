"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function FestivalSubmissionsPage() {
  const [festivalId, setFestivalId] = useState("");

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = list?.festivals ?? [];
  const activeId = festivalId || festivals[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["festival-submissions-all", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/submissions`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Submissions</h1>
        <p className="mt-1 text-sm text-slate-400">Paid festival entries awaiting review.</p>
      </div>

      <select
        value={activeId}
        onChange={(e) => setFestivalId(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        {festivals.map((f: { id: string; name: string }) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {(data?.submissions ?? []).map((s: {
            id: string;
            title: string;
            feeAmountZar: number;
            reviewStage: string;
            selectionStatus: string;
            creator?: { name: string | null; email: string | null };
          }) => (
            <li key={s.id}>
              <Link
                href={`/festival/review/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-4 py-3 hover:border-amber-500/30"
              >
                <div>
                  <p className="font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.creator?.name || s.creator?.email}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p>R{Number(s.feeAmountZar).toFixed(2)}</p>
                  <p>{s.reviewStage} · {s.selectionStatus.replace(/_/g, " ")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
