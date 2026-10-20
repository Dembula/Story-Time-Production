"use client";

import { useQuery } from "@tanstack/react-query";

export default function AdminFestivalRemittancesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-festival-remittances"],
    queryFn: () => fetch("/api/admin/festival-remittances").then((r) => r.json()),
  });

  const platformPct = data?.summary?.platformSharePercent ?? 15;
  const curatorPct = data?.summary?.curatorSharePercent ?? 85;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Festival remittances</h1>
        <p className="mt-1 text-sm text-slate-400">
          Split is {curatorPct}% festival / {platformPct}% Story Time on submission fees. Curator signup is free.
        </p>
      </div>

      {data?.summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">Paid submissions</p>
            <p className="text-2xl font-semibold text-white">{data.summary.count}</p>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">Gross collected</p>
            <p className="text-2xl font-semibold text-white">
              R{Number(data.summary.grossHeldZar).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">
              Platform revenue ({platformPct}%)
            </p>
            <p className="text-2xl font-semibold text-emerald-200">
              R{Number(data.summary.platformRevenueZar ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase text-slate-500">
              Owed to festivals ({curatorPct}%)
            </p>
            <p className="text-2xl font-semibold text-amber-200">
              R{Number(data.summary.netOwedToFestivalsZar ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
      ) : null}
      {data?.summary?.note ? <p className="text-xs text-slate-500">{data.summary.note}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
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
            <li key={r.paymentId} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <div>
                <p className="text-white">{r.submissionTitle || r.paymentId}</p>
                <p className="text-xs text-slate-500">
                  {r.festivalName} · {r.festivalOwnerEmail}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white">
                  R{Number(r.festivalNetZar ?? r.amount).toFixed(2)}
                  <span className="ml-1 text-xs font-normal text-slate-500">to festival</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Gross R{Number(r.amount).toFixed(2)}
                  {typeof r.platformFeeZar === "number"
                    ? ` · ST R${Number(r.platformFeeZar).toFixed(2)}`
                    : ""}
                </p>
                <p className="text-[11px] text-amber-200/80">{r.remittanceStatus.replace(/_/g, " ")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
