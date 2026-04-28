"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function FundersHomePage() {
  const { data } = useQuery({
    queryKey: ["funder-portfolio-summary"],
    queryFn: async () => fetch("/api/funders/portfolio").then((r) => r.json()),
  });
  const metrics = data?.metrics;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-semibold">Funders Portal</h1>
      <p className="mt-2 text-sm text-slate-400">
        Discover opportunities, negotiate terms, sign deal contracts, and track portfolio returns.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="Invested" value={`R${Number(metrics?.invested ?? 0).toLocaleString()}`} />
        <Metric label="Paid out" value={`R${Number(metrics?.paidOut ?? 0).toLocaleString()}`} />
        <Metric label="Pending payout" value={`R${Number(metrics?.pendingPayout ?? 0).toLocaleString()}`} />
        <Metric label="ROI" value={`${Number(metrics?.roiPct ?? 0).toFixed(1)}%`} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/funders/verification" className="rounded border border-slate-700 px-4 py-2 text-sm">
          Complete verification
        </Link>
        <Link href="/funders/opportunities" className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-black">
          Browse opportunities
        </Link>
        <Link href="/funders/deals" className="rounded border border-slate-700 px-4 py-2 text-sm">
          Manage deals
        </Link>
        <Link href="/funders/portfolio" className="rounded border border-slate-700 px-4 py-2 text-sm">
          View portfolio
        </Link>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
