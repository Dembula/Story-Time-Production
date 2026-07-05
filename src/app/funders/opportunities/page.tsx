"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FUNDING_MARKET_LABELS } from "@/lib/funder-markets";
import Link from "next/link";
import { useFunderVerificationState } from "@/components/funders/funder-verification-banner";
import { formatZar } from "@/lib/format-currency-zar";

type PublicView = {
  id: string;
  title: string;
  logline?: string | null;
  genre?: string | null;
  format?: string | null;
  budgetBand?: string | null;
  stage?: string | null;
  territory?: string | null;
  useOfFunds?: string | null;
  revenueModel?: string | null;
  teamCredibility?: string | null;
  equityOfferedPct?: number | null;
  termsSummary?: string | null;
  fundingTarget: number;
  marketCategory: string;
  privacyLocked: boolean;
  projectTitle?: string | null;
  fullDescription?: string | null;
};

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
  const { investingUnlocked } = useFunderVerificationState();

  return (
    <main className="space-y-5 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <h1 className="text-2xl font-semibold">Investment Opportunities</h1>
        <p className="mt-1 text-sm text-slate-400">
          Browse privacy-safe teasers only. Script, cast, and full budget details unlock after you express interest and enter a deal room with the creator.
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
        {opportunities.map((opp: { id: string; status: string; publicView: PublicView }) => {
          const view = opp.publicView;
          return (
            <div key={opp.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-panel">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-orange-300">
                      {FUNDING_MARKET_LABELS[view.marketCategory as keyof typeof FUNDING_MARKET_LABELS] ??
                        view.marketCategory}
                    </p>
                    {view.privacyLocked ? (
                      <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        Teaser only
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                        Full access
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-white">{view.title}</h2>
                  {view.logline ? <p className="mt-1 text-sm text-slate-300">{view.logline}</p> : null}
                  <div className="mt-2 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                    {view.genre ? <p>Genre: {view.genre}</p> : null}
                    {view.format ? <p>Format: {view.format}</p> : null}
                    {view.stage ? <p>Stage: {view.stage}</p> : null}
                    {view.territory ? <p>Territory: {view.territory}</p> : null}
                    {view.budgetBand ? <p>Budget band: {view.budgetBand}</p> : null}
                    {view.equityOfferedPct != null ? <p>Equity offered: {view.equityOfferedPct}%</p> : null}
                  </div>
                  {view.useOfFunds ? (
                    <p className="mt-2 text-xs text-slate-400">
                      <span className="text-slate-500">Use of funds:</span> {view.useOfFunds}
                    </p>
                  ) : null}
                  {view.teamCredibility ? (
                    <p className="mt-1 text-xs text-slate-400">
                      <span className="text-slate-500">Team:</span> {view.teamCredibility}
                    </p>
                  ) : null}
                  {!view.privacyLocked && view.fullDescription ? (
                    <p className="mt-2 text-sm text-slate-300">{view.fullDescription}</p>
                  ) : null}
                  {!view.privacyLocked && view.projectTitle ? (
                    <p className="mt-1 text-xs text-emerald-300">Project: {view.projectTitle}</p>
                  ) : null}
                </div>
                {investingUnlocked ? (
                  <button
                    type="button"
                    onClick={() => investMutation.mutate(opp.id)}
                    className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
                  >
                    Express interest
                  </button>
                ) : (
                  <div className="shrink-0 text-right">
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                      title="Complete verification to invest"
                    >
                      Express interest
                    </button>
                    <p className="mt-1 text-[11px] text-amber-300/90">
                      <Link href="/funders/verification" className="underline hover:text-amber-200">
                        Verification required
                      </Link>
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Target: {formatZar(view.fundingTarget, { maximumFractionDigits: 0 })} · Status: {opp.status}
                {view.revenueModel ? ` · ${view.revenueModel}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
