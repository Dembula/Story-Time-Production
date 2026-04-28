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
    <main className="space-y-6 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-panel">
        <h1 className="text-3xl font-semibold">Funder Dashboard</h1>
        <p className="mt-2 text-sm text-slate-400">
          Discover opportunities, negotiate terms, execute deals, and monitor your capital performance from one place.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/funders/verification" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-white/[0.04]">
            Complete verification
          </Link>
          <Link href="/funders/opportunities" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-black hover:bg-orange-400">
            Browse opportunities
          </Link>
          <Link href="/funders/deals" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-white/[0.04]">
            Manage deals
          </Link>
          <Link href="/funders/portfolio" className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-white/[0.04]">
            View portfolio
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Invested" value={`R${Number(metrics?.invested ?? 0).toLocaleString()}`} />
        <Metric label="Paid out" value={`R${Number(metrics?.paidOut ?? 0).toLocaleString()}`} />
        <Metric label="Pending payout" value={`R${Number(metrics?.pendingPayout ?? 0).toLocaleString()}`} />
        <Metric label="ROI" value={`${Number(metrics?.roiPct ?? 0).toFixed(1)}%`} />
      </div>

      <div className="rounded-2xl border border-white/8 bg-slate-950/60 p-5">
        <h2 className="text-lg font-semibold text-white">Quick actions</h2>
        <p className="mt-1 text-sm text-slate-400">
          Use the left menu for full navigation. If you are in verification, you can always return here via Dashboard.
        </p>
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
