"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export default function FestivalPayoutsPage() {
  const [festivalId, setFestivalId] = useState("");

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = list?.festivals ?? [];
  const activeId = festivalId || festivals[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["festival-payouts", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/payouts`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Payouts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Submission fees collected by Story Time via PayFast and held for remittance to your festival.
        </p>
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

      {data?.summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">Paid submissions</p>
            <p className="text-2xl font-semibold text-white">{data.summary.paidSubmissionCount}</p>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">Gross fees</p>
            <p className="text-2xl font-semibold text-white">R{Number(data.summary.grossFeesZar).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">Held for festival</p>
            <p className="text-2xl font-semibold text-amber-200">R{Number(data.summary.netOwedToFestivalZar).toFixed(2)}</p>
          </div>
        </div>
      ) : null}
      {data?.summary?.note ? <p className="text-xs text-slate-500">{data.summary.note}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {(data?.rows ?? []).map((r: {
            submissionId: string;
            title: string;
            feeAmountZar: number;
            remittanceStatus: string;
            creatorName?: string | null;
          }) => (
            <li key={r.submissionId} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <div>
                <p className="text-white">{r.title}</p>
                <p className="text-xs text-slate-500">{r.creatorName}</p>
              </div>
              <div className="text-right">
                <p className="text-white">R{Number(r.feeAmountZar).toFixed(2)}</p>
                <p className="text-[11px] text-amber-200/80">{r.remittanceStatus.replace(/_/g, " ")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
