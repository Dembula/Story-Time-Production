"use client";

import { useQuery } from "@tanstack/react-query";

export default function FunderPortfolioPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["funder-portfolio"],
    queryFn: async () => fetch("/api/funders/portfolio").then((r) => r.json()),
  });
  const metrics = data?.metrics ?? {};
  const payouts = data?.payouts ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Portfolio & Returns</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Invested" value={`R${Number(metrics.invested ?? 0).toLocaleString()}`} />
        <Card label="Paid out" value={`R${Number(metrics.paidOut ?? 0).toLocaleString()}`} />
        <Card label="Pending" value={`R${Number(metrics.pendingPayout ?? 0).toLocaleString()}`} />
        <Card label="ROI" value={`${Number(metrics.roiPct ?? 0).toFixed(2)}%`} />
      </div>
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-lg font-semibold">Payout tracker</h2>
        {isLoading && <p className="mt-2 text-sm text-slate-400">Loading payout history...</p>}
        <div className="mt-3 space-y-2">
          {payouts.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded border border-slate-800 px-3 py-2 text-sm">
              <span>{p.status}</span>
              <span>R{Number(p.amount ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
