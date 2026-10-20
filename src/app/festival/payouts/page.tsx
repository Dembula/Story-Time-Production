"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type Receipt = {
  receiptId: string;
  submissionId: string;
  filmTitle: string;
  categoryName: string;
  filmmakerName: string;
  filmmakerEmail: string;
  submissionFeeZar: number;
  yourEarningsZar: number;
  paidAt: string | null;
  remittanceStatus: string;
};

function formatZar(n: number) {
  return `R${Number(n).toFixed(2)}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function FestivalRevenuePage() {
  const [festivalId, setFestivalId] = useState("");

  const { data: list } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });
  const festivals = list?.festivals ?? [];
  const activeId = festivalId || festivals[0]?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: ["festival-revenue", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/payouts`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const receipts: Receipt[] = data?.receipts ?? [];
  const sharePct = data?.summary?.curatorSharePercent ?? 85;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">Revenue</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your share of paid submission fees ({sharePct}%), with a receipt for each filmmaker who submitted.
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Your revenue</p>
            <p className="mt-1 font-display text-3xl font-semibold text-amber-200">
              {formatZar(data.summary.yourRevenueZar)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {sharePct}% of paid submissions · held for remittance
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 p-5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid submissions</p>
            <p className="mt-1 text-3xl font-semibold text-white">{data.summary.paidSubmissionCount}</p>
            <p className="mt-2 text-xs text-slate-500">
              {data.festival?.name ? `Festival: ${data.festival.name}` : "Receipts below"}
            </p>
          </div>
        </div>
      ) : null}

      {data?.summary?.note ? <p className="text-xs text-slate-500">{data.summary.note}</p> : null}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Submission receipts
        </h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : receipts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No paid submissions yet. When filmmakers pay to enter, receipts appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {receipts.map((r) => (
              <li
                key={r.receiptId}
                className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-white">{r.filmTitle}</p>
                    <p className="text-sm text-slate-300">
                      {r.filmmakerName}
                      <span className="text-slate-500"> · {r.filmmakerEmail}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.categoryName} · Paid {formatWhen(r.paidAt)}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Receipt {r.receiptId.slice(0, 12)}…
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-amber-200">
                      {formatZar(r.yourEarningsZar)}
                    </p>
                    <p className="text-[11px] text-slate-500">Your earnings</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Submission fee {formatZar(r.submissionFeeZar)}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-amber-200/70">
                      {r.remittanceStatus.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
