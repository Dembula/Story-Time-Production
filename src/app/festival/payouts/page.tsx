"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Receipt, ShieldCheck, Wallet } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { FestivalScopeSelect } from "@/components/festival/festival-scope-select";
import { useActiveFestival } from "@/components/festival/use-active-festival";
import { PayoutKycBanner } from "@/components/payout-kyc/payout-kyc-banner";

type ReceiptRow = {
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
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function FestivalRevenuePage() {
  const { festivals, activeId, setActiveFestivalId, isLoading: listLoading } = useActiveFestival();

  const { data, isLoading } = useQuery({
    queryKey: ["festival-revenue", activeId],
    queryFn: () => fetch(`/api/festival/${activeId}/payouts`).then((r) => r.json()),
    enabled: Boolean(activeId),
  });

  const receipts: ReceiptRow[] = data?.receipts ?? [];
  const sharePct = data?.summary?.curatorSharePercent ?? 85;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OpsPageHeader
        title="Revenue"
        subtitle={`Your ${sharePct}% of paid submission fees.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/festival/wallet"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-3 py-2 text-sm text-slate-200 hover:border-orange-500/40"
            >
              <Wallet className="h-4 w-4" /> Wallet
            </Link>
            <Link
              href="/payout-verification"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/90 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              <ShieldCheck className="h-4 w-4" /> Complete KYB
            </Link>
          </div>
        }
      />

      <PayoutKycBanner />

      <FestivalScopeSelect
        festivals={festivals}
        value={activeId}
        onChange={setActiveFestivalId}
        isLoading={listLoading}
      />

      {!activeId ? (
        <FestivalEmptyPanel
          icon={Receipt}
          title="Select a festival"
          actionHref="/festival/festivals"
          actionLabel="My festivals"
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <OpsMetricCard
              label="Your revenue"
              value={formatZar(data?.summary?.yourRevenueZar ?? 0)}
              sub={`${sharePct}% · held for remittance`}
              icon={Receipt}
              accent="amber"
            />
            <OpsMetricCard
              label="Paid submissions"
              value={data?.summary?.paidSubmissionCount ?? 0}
              accent="orange"
            />
            <OpsMetricCard
              label="Payout setup"
              value="KYB"
              sub="Verify to withdraw from wallet"
              icon={ShieldCheck}
              accent="emerald"
            />
          </div>

          <OpsSection title="Payout readiness">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/payout-verification"
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-orange-500/30"
              >
                <p className="font-semibold text-white">KYB / banking</p>
                <p className="mt-1 text-sm text-slate-400">
                  Complete identity and business verification to enable payouts.
                </p>
              </Link>
              <Link
                href="/festival/wallet"
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-orange-500/30"
              >
                <p className="font-semibold text-white">Festival wallet</p>
                <p className="mt-1 text-sm text-slate-400">
                  View balances and request withdrawals after approval.
                </p>
              </Link>
            </div>
          </OpsSection>

          <OpsSection title="Submission receipts">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : receipts.length === 0 ? (
              <FestivalEmptyPanel
                icon={Receipt}
                title="No paid submissions yet"
                body="Filmmaker receipts appear here after PayFast payment."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Film / filmmaker</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Your earnings</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r) => (
                      <tr key={r.receiptId} className="border-t border-white/8">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{r.filmTitle}</p>
                          <p className="text-xs text-slate-400">
                            {r.filmmakerName} · {r.filmmakerEmail}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            Fee {formatZar(r.submissionFeeZar)} · #{r.receiptId.slice(0, 10)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{r.categoryName}</td>
                        <td className="px-4 py-3 text-slate-400">{formatWhen(r.paidAt)}</td>
                        <td className="px-4 py-3 font-semibold text-amber-200">
                          {formatZar(r.yourEarningsZar)}
                        </td>
                        <td className="px-4 py-3 text-[11px] uppercase text-slate-500">
                          {r.remittanceStatus.replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </OpsSection>
        </>
      )}
    </div>
  );
}
