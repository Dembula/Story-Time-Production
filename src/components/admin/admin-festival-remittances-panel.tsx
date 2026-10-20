"use client";

import { useQuery } from "@tanstack/react-query";

export function AdminFestivalRemittancesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-festival-remittances"],
    queryFn: () => fetch("/api/admin/festival-remittances").then((r) => r.json()),
  });

  const platformPct = data?.summary?.platformSharePercent ?? 15;
  const curatorPct = data?.summary?.curatorSharePercent ?? 85;

  return (
    <section className="space-y-4">
      <div className="storytime-plan-card p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white">Festival submission remittances</h2>
        <p className="mt-1 text-xs text-slate-500">
          {curatorPct}% festival / {platformPct}% Story Time on paid submission settlements. Curator signup is free.
        </p>
      </div>

      {data?.summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Paid submissions</p>
            <p className="mt-1 text-xl font-semibold text-white">{data.summary.count}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Gross collected</p>
            <p className="mt-1 text-xl font-semibold text-white">
              R{Number(data.summary.grossHeldZar).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Platform ({platformPct}%)
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-200">
              R{Number(data.summary.platformRevenueZar ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Owed to festivals ({curatorPct}%)
            </p>
            <p className="mt-1 text-xl font-semibold text-amber-200">
              R{Number(data.summary.netOwedToFestivalsZar ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}
      {data?.summary?.note ? <p className="text-xs text-slate-500">{data.summary.note}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Submission</th>
                <th className="px-3 py-2.5">Festival</th>
                <th className="px-3 py-2.5">Gross</th>
                <th className="px-3 py-2.5">ST</th>
                <th className="px-3 py-2.5">Festival net</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r: {
                paymentId: string;
                amount: number;
                platformFeeZar?: number;
                festivalNetZar?: number;
                festivalName?: string | null;
                submissionTitle?: string | null;
                festivalOwnerEmail?: string | null;
                remittanceStatus: string;
              }) => (
                <tr key={r.paymentId} className="border-t border-white/8">
                  <td className="px-3 py-2.5 text-white">{r.submissionTitle || r.paymentId}</td>
                  <td className="px-3 py-2.5 text-slate-400">
                    <div>{r.festivalName}</div>
                    <div className="text-[11px] text-slate-600">{r.festivalOwnerEmail}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">R{Number(r.amount).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-emerald-200/90">
                    R{Number(r.platformFeeZar ?? 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-amber-200">
                    R{Number(r.festivalNetZar ?? r.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] uppercase text-slate-500">
                    {r.remittanceStatus.replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
              {(data?.rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No festival submission payments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
