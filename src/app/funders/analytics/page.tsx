"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OpsPageHeader } from "@/components/ecosystem/ops-shell";
import { formatZar } from "@/lib/format-currency-zar";

export default function FunderAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["funder-analytics"],
    queryFn: () => fetch("/api/funders/analytics").then((r) => r.json()),
  });

  const a = data?.analytics;
  const monthly = a?.monthlySeries ?? [];
  const pipeline = Object.entries(a?.pipelineByStatus ?? {}).map(([name, value]) => ({ name, value: Number(value) }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <OpsPageHeader title="Market analytics" subtitle="Bloomberg-style portfolio view — capital deployed, returns, and deal pipeline." />
      {isLoading && <p className="text-sm text-slate-500">Loading analytics…</p>}
      {a?.headline && (
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Invested" value={formatZar(a.headline.invested)} />
          <Metric label="Paid out" value={formatZar(a.headline.paidOut)} />
          <Metric label="ROI" value={`${a.headline.roiPct.toFixed(1)}%`} />
          <Metric label="Active deals" value={String(a.headline.activeDeals)} />
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 h-72">
        <h2 className="mb-3 text-sm font-semibold text-white">Capital flow (12 months)</h2>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Legend />
            <Line type="monotone" dataKey="invested" stroke="#f97316" name="Invested" dot={false} />
            <Line type="monotone" dataKey="paidOut" stroke="#22c55e" name="Paid out" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 h-64">
        <h2 className="mb-3 text-sm font-semibold text-white">Deal pipeline</h2>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={pipeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Bar dataKey="value" fill="#38bdf8" name="Deals" />
          </BarChart>
        </ResponsiveContainer>
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
