"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FUNDING_MARKET_LABELS } from "@/lib/funder-markets";

export default function FunderOpportunitiesPage() {
  const qc = useQueryClient();
  const [market, setMarket] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["funder-opportunities", market],
    queryFn: async () =>
      fetch(`/api/funders/opportunities${market ? `?market=${encodeURIComponent(market)}` : ""}`).then((r) => r.json()),
  });
  const investMutation = useMutation({
    mutationFn: async (opportunityId: string) =>
      fetch("/api/funders/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXPRESS_INTEREST", opportunityId }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-opportunities"] }),
  });
  const opportunities = useMemo(() => data?.opportunities ?? [], [data?.opportunities]);

  return (
    <main className="space-y-5 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <h1 className="text-2xl font-semibold">Investment Opportunities</h1>
        <p className="mt-1 text-sm text-slate-400">
          Filter by market category and express interest to open a deal room with the creator.
        </p>
        <div className="mt-4">
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">All markets</option>
            {Object.entries(FUNDING_MARKET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-slate-400">Loading opportunities...</p>}
        {!isLoading && opportunities.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-400">
            No opportunities are currently listed for this filter.
          </div>
        )}
        {opportunities.map((opp: any) => (
          <div key={opp.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-orange-300">{FUNDING_MARKET_LABELS[opp.marketCategory as keyof typeof FUNDING_MARKET_LABELS] ?? opp.marketCategory}</p>
                <h2 className="text-lg font-semibold text-white">{opp.title}</h2>
                <p className="mt-1 text-sm text-slate-300">{opp.description || "No description provided."}</p>
              </div>
              <button
                onClick={() => investMutation.mutate(opp.id)}
                className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
              >
                Express interest
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Target: R{Number(opp.fundingTarget ?? 0).toLocaleString()} · Status: {opp.status}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
