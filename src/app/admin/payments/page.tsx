"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Eye, Landmark, ShieldCheck, Wallet, UserMinus } from "lucide-react";
import { AdminTransactionDetailModal } from "@/components/admin/admin-transaction-detail-modal";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { PAYMENT_PURPOSE_LABELS } from "@/lib/admin/payment-transaction-detail.types";

const money = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type PayoutBanking = {
  bankName?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
  branchCode?: string | null;
  accountHolderName?: string | null;
  verifiedAt?: string | null;
};

type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  provider: string;
  providerReference?: string | null;
  declineReason?: string | null;
  adminNotes?: string | null;
  proofUrl?: string | null;
  proofReference?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    creatorBanking?: PayoutBanking | null;
    payoutKycProfile?: {
      legalName?: string | null;
      verificationStatus?: string | null;
      kycData?: { financialInfo?: PayoutBanking & { accountHolderName?: string } } | null;
    } | null;
  };
};

function resolvePayoutBanking(p: PayoutRow): PayoutBanking | null {
  const banking = p.user?.creatorBanking;
  const fin = p.user?.payoutKycProfile?.kycData?.financialInfo;
  if (!banking?.accountNumber && !fin?.accountNumber) return null;
  return {
    bankName: banking?.bankName ?? fin?.bankName ?? null,
    accountNumber: banking?.accountNumber ?? fin?.accountNumber ?? null,
    accountType: banking?.accountType ?? fin?.accountType ?? null,
    branchCode: banking?.branchCode ?? fin?.branchCode ?? null,
    accountHolderName:
      fin?.accountHolderName ?? p.user?.payoutKycProfile?.legalName ?? p.user?.name ?? null,
    verifiedAt: banking?.verifiedAt ?? null,
  };
}

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => fetch("/api/admin/payments").then((r) => r.json()),
  });
  const [tab, setTab] = useState<"payments" | "marketplace" | "payouts" | "escrow" | "events" | "trials" | "cancellations">("payouts");
  const [detailKind, setDetailKind] = useState<"payment" | "marketplace" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: churnData, isLoading: churnLoading } = useQuery({
    queryKey: ["admin-churn"],
    queryFn: async () => fetch("/api/admin/churn").then((r) => r.json()),
  });
  const churnMetrics = churnData?.metrics ?? {};
  const cancelledSubscriptions = (churnData?.cancelledSubscriptions ?? []) as Array<{
    id: string;
    segmentLabel: string;
    userName: string | null;
    userEmail: string | null;
    userRole: string | null;
    planLabel: string;
    status: string;
    churnState: string;
    cancelAtPeriodEnd: boolean;
    periodEnd: string | null;
    updatedAt: string;
    lastPaymentError: string | null;
  }>;
  const cancelledTransactions = (churnData?.cancelledTransactions ?? []) as Array<{
    id: string;
    source: string;
    status: string;
    amount: number;
    purposeLabel: string | null;
    userName: string | null;
    userEmail: string | null;
    userRole: string | null;
    counterpartyName: string | null;
    createdAt: string;
    failureReason: string | null;
  }>;

  const metrics = data?.metrics ?? {};
  const paymentRecords = (data?.paymentRecords ?? []) as any[];
  const marketplaceTransactions = (data?.transactions ?? []) as any[];
  const payouts = (data?.payouts ?? []) as PayoutRow[];
  const escrows = (data?.escrows ?? []) as any[];
  const gatewayEvents = (data?.gatewayEvents ?? []) as any[];
  const trialSignups = (data?.trialSignups ?? []) as Array<{
    id: string;
    userName: string | null;
    userEmail: string | null;
    planLabel: string;
    potentialMonthlyRevenue: number;
    status: string;
    trialEndsAt: string | null;
    createdAt: string;
    isActiveTrial: boolean;
    hasConverted: boolean;
  }>;
  const selectedPayout = payouts.find((p) => p.id === selectedPayoutId) ?? null;

  const payoutAction = useMutation({
    mutationFn: async (payload: {
      id: string;
      action: "approve" | "decline" | "mark_paid";
      declineReason?: string;
      adminNotes?: string;
      proofReference?: string;
      proofUrl?: string;
    }) => {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Payout action failed");
      return json;
    },
    onSuccess: () => {
      setActionError(null);
      setDeclineReason("");
      setProofReference("");
      setProofUrl("");
      void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const cards = useMemo(
    () => [
      { label: "Payment pending", value: String(metrics.paymentPending ?? 0), tone: "text-amber-300" },
      { label: "Payment succeeded", value: String(metrics.paymentSucceeded ?? 0), tone: "text-emerald-300" },
      { label: "Payout queue", value: String(metrics.payoutProcessing ?? 0), tone: "text-orange-300" },
      {
        label: "Treasury cash (available)",
        value: `R${money.format(Number(metrics.platformAvailableBalance ?? 0))}`,
        tone: "text-emerald-300",
      },
      {
        label: "Gross inflow (succeeded)",
        value: `R${money.format(Number(metrics.grossInflow ?? 0))}`,
        tone: "text-cyan-300",
      },
      {
        label: "Net inflow (after PayFast)",
        value: `R${money.format(Number(metrics.netInflow ?? metrics.grossInflow ?? 0))}`,
        tone: "text-emerald-300",
      },
      {
        label: "PayFast fees (recorded)",
        value: `R${money.format(Number(metrics.payfastFeesTotal ?? 0))}`,
        tone: "text-red-300",
      },
      {
        label: "Creator pool (60% of net viewer revenue)",
        value: `R${money.format(Number(metrics.viewerCreatorPool ?? 0))}`,
        tone: "text-green-300",
      },
      {
        label: "Marketplace fees (3%)",
        value: `R${money.format(Number(metrics.marketplaceFees ?? 0))}`,
        tone: "text-violet-300",
      },
      {
        label: "Manual payouts completed",
        value: `R${money.format(Number(metrics.payoutCompletedTotal ?? 0))}`,
        tone: "text-violet-300",
      },
      {
        label: "Active free trials",
        value: String(metrics.activeTrialCount ?? 0),
        tone: "text-cyan-300",
      },
      {
        label: "Potential trial revenue / mo",
        value: `R${money.format(Number(metrics.potentialMonthlyRevenue ?? 0))}`,
        tone: "text-cyan-200",
      },
      {
        label: "Scheduled cancels",
        value: String(churnMetrics.subscriptionsScheduledCancel ?? 0),
        tone: "text-amber-300",
      },
      {
        label: "Gateway cancelled / failed",
        value: String(
          Number(churnMetrics.gatewayPaymentsCancelled ?? 0) + Number(churnMetrics.gatewayPaymentsFailed ?? 0),
        ),
        tone: "text-red-300",
      },
      {
        label: "Total platform position",
        value: `R${money.format(Number(metrics.netRetained ?? 0))}`,
        tone: "text-lime-300",
      },
    ],
    [metrics, churnMetrics],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 text-slate-100 md:px-8 md:py-8">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Finance Ops</p>
        <h1 className="flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <Wallet className="h-8 w-8 text-orange-500" />
          Payments control center
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Viewer subs split 60% creator pool / 40% Story Time. Marketplace 3%, licences, script review, and casting fees
          book to platform revenue. All withdrawal requests are reviewed and paid manually here.
        </p>
      </header>

      {isLoading ? <p className="text-sm text-slate-400">Loading payment telemetry...</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton label="Manual payouts" active={tab === "payouts"} onClick={() => setTab("payouts")} />
        <TabButton label="Gateway payments" active={tab === "payments"} onClick={() => setTab("payments")} />
        <TabButton label="Marketplace tx" active={tab === "marketplace"} onClick={() => setTab("marketplace")} />
        <TabButton label="Escrow" active={tab === "escrow"} onClick={() => setTab("escrow")} />
        <TabButton label="Free trial signups" active={tab === "trials"} onClick={() => setTab("trials")} />
        <TabButton label="Cancellations & churn" active={tab === "cancellations"} onClick={() => setTab("cancellations")} />
        <TabButton label="Gateway events" active={tab === "events"} onClick={() => setTab("events")} />
      </div>

      {tab === "payouts" ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
            <SectionHeader icon={<ArrowRight className="h-4 w-4 text-orange-400" />} title="Withdrawal requests" />
            <div className="mt-3 space-y-2">
              {payouts.length === 0 ? (
                <p className="text-sm text-slate-500">No payout requests yet.</p>
              ) : null}
              {payouts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPayoutId(p.id);
                    setAdminNotes(p.adminNotes ?? "");
                    setActionError(null);
                  }}
                  className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-3 text-left text-xs transition ${
                    selectedPayoutId === p.id ? "border-orange-500/50 bg-orange-500/5" : "border-slate-800 hover:bg-slate-900/50"
                  }`}
                >
                  <StatusPill value={p.status} />
                  <div>
                    <p className="font-medium text-white">{p.user?.name || p.user?.email || "User"}</p>
                    <p className="text-slate-500">{p.user?.role} · {new Date(p.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="font-semibold text-white">R{money.format(Number(p.amount ?? 0))}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
            <SectionHeader icon={<ShieldCheck className="h-4 w-4 text-orange-400" />} title="Review & proof" />
            {!selectedPayout ? (
              <p className="mt-3 text-sm text-slate-500">Select a withdrawal request to approve, decline, or mark paid.</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-white font-medium">{selectedPayout.user?.name || "—"}</p>
                  <p className="text-slate-400">{selectedPayout.user?.email}</p>
                  <p className="mt-2 text-lg font-semibold text-orange-300">R{money.format(selectedPayout.amount)}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {selectedPayout.status}</p>
                  {selectedPayout.declineReason ? (
                    <p className="text-xs text-red-300 mt-2">Declined: {selectedPayout.declineReason}</p>
                  ) : null}
                  {selectedPayout.proofReference ? (
                    <p className="text-xs text-emerald-300 mt-2">Proof ref: {selectedPayout.proofReference}</p>
                  ) : null}
                  {selectedPayout.proofUrl ? (
                    <SecureFileLink
                      fileRef={selectedPayout.proofUrl}
                      label="View proof document"
                      context="admin"
                      className="text-xs text-cyan-300 mt-1 block underline"
                    />
                  ) : null}
                </div>

                {(() => {
                  const banking = resolvePayoutBanking(selectedPayout);
                  if (!banking) {
                    return (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        No banking details on file for this user. Ask them to complete payout KYC.
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
                        Pay to (full account details)
                      </p>
                      <p className="text-slate-200">
                        <span className="text-slate-500">Bank:</span> {banking.bankName || "—"}
                      </p>
                      <p className="text-slate-200">
                        <span className="text-slate-500">Holder:</span> {banking.accountHolderName || "—"}
                      </p>
                      <p className="font-mono text-base tracking-wide text-white">
                        <span className="mr-2 font-sans text-xs text-slate-500">Account</span>
                        {banking.accountNumber || "—"}
                      </p>
                      <p className="font-mono text-slate-200">
                        <span className="mr-2 font-sans text-slate-500">Branch</span>
                        {banking.branchCode || "—"}
                      </p>
                      <p className="text-slate-400">
                        Type: {banking.accountType || "—"}
                        {banking.verifiedAt
                          ? ` · Verified ${new Date(banking.verifiedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                      {selectedPayout.user?.payoutKycProfile?.verificationStatus ? (
                        <p className="text-slate-500">
                          KYC: {selectedPayout.user.payoutKycProfile.verificationStatus}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}

                <label className="block">
                  <span className="text-xs text-slate-500">Admin notes (internal)</span>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                </label>

                {selectedPayout.status === "PENDING_REVIEW" || selectedPayout.status === "PROCESSING" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={payoutAction.isPending}
                      onClick={() =>
                        payoutAction.mutate({
                          id: selectedPayout.id,
                          action: "approve",
                          adminNotes,
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Approve for payout
                    </button>
                  </div>
                ) : null}

                {["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(selectedPayout.status) ? (
                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <label className="block">
                      <span className="text-xs text-slate-500">Decline reason (shown to user)</span>
                      <textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={payoutAction.isPending || !declineReason.trim()}
                      onClick={() =>
                        payoutAction.mutate({
                          id: selectedPayout.id,
                          action: "decline",
                          declineReason,
                          adminNotes,
                        })
                      }
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 disabled:opacity-50"
                    >
                      Decline & release funds
                    </button>
                  </div>
                ) : null}

                {selectedPayout.status === "APPROVED" || selectedPayout.status === "PROCESSING" ? (
                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <label className="block">
                      <span className="text-xs text-slate-500">EFT / payment reference</span>
                      <input
                        value={proofReference}
                        onChange={(e) => setProofReference(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        placeholder="e.g. ABSA ref 123456"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-500">Proof URL (optional)</span>
                      <input
                        value={proofUrl}
                        onChange={(e) => setProofUrl(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                        placeholder="https://..."
                      />
                    </label>
                    <button
                      type="button"
                      disabled={payoutAction.isPending || (!proofReference.trim() && !proofUrl.trim())}
                      onClick={() =>
                        payoutAction.mutate({
                          id: selectedPayout.id,
                          action: "mark_paid",
                          proofReference,
                          proofUrl,
                          adminNotes,
                        })
                      }
                      className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Mark paid (manual EFT done)
                    </button>
                  </div>
                ) : null}

                {actionError ? <p className="text-xs text-red-400">{actionError}</p> : null}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "payments" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<Landmark className="h-4 w-4 text-orange-400" />} title="Gateway payments (PayFast)" />
          <p className="mt-2 text-xs text-slate-500">
            Viewer subscriptions, creator licences, company listings, marketplace checkout, and platform services.
          </p>
          <div className="mt-3 space-y-2">
            {paymentRecords.length === 0 ? (
              <p className="text-sm text-slate-500">No payment records yet.</p>
            ) : null}
            {paymentRecords.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-800 px-3 py-3 text-xs sm:grid-cols-[1.4fr_auto_auto_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">
                    {PAYMENT_PURPOSE_LABELS[p.purpose] ?? String(p.purpose).replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {p.user?.name || p.user?.email || "Unknown payer"} · {p.user?.role || "—"}
                  </p>
                </div>
                <StatusPill value={p.status} />
                <div className="text-right sm:text-left">
                  <span className="font-medium text-white">R{money.format(Number(p.amount ?? 0))}</span>
                  {p.settlementAmount != null && Number(p.settlementAmount) !== Number(p.amount) ? (
                    <p className="text-[10px] text-emerald-400">
                      net R{money.format(Number(p.settlementAmount))}
                    </p>
                  ) : null}
                </div>
                <span className="truncate font-mono text-slate-500">{p.id}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDetailKind("payment");
                    setDetailId(p.id);
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "marketplace" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ArrowRight className="h-4 w-4 text-orange-400" />} title="Marketplace transactions" />
          <p className="mt-2 text-xs text-slate-500">
            Location, catering, equipment, crew, and casting payments — includes 3% Story Time fee breakdown.
          </p>
          <div className="mt-3 space-y-2">
            {marketplaceTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">No marketplace transactions yet.</p>
            ) : null}
            {marketplaceTransactions.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-800 px-3 py-3 text-xs sm:grid-cols-[1.2fr_auto_auto_1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-200">{String(t.type).replace(/_/g, " ")}</p>
                  <p className="mt-0.5 truncate text-slate-500">
                    {t.payer?.email || t.payerId} → {t.payee?.email || t.payeeId}
                  </p>
                </div>
                <StatusPill value={t.status} />
                <div className="text-right sm:text-left">
                  <p className="font-medium text-white">R{money.format(Number(t.totalAmount ?? 0))}</p>
                  <p className="text-[10px] text-slate-500">fee R{money.format(Number(t.feeAmount ?? 0))}</p>
                </div>
                <span className="truncate font-mono text-slate-500">{t.id}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDetailKind("marketplace");
                    setDetailId(t.id);
                  }}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "escrow" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ShieldCheck className="h-4 w-4 text-orange-400" />} title="Escrow accounts" />
          <p className="mt-2 text-xs text-slate-500">
            Marketplace payments stay HELD until the buyer confirms delivery. Disputed escrows can be released or refunded here.
          </p>
          <div className="mt-3 space-y-2">
            {escrows.map((e) => {
              const linkedTx = marketplaceTransactions.find((t) => t.referenceId === e.referenceId);
              return (
                <div
                  key={e.id}
                  className="grid grid-cols-1 items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs sm:grid-cols-[1fr_auto_auto_1fr_auto]"
                >
                  <span className="text-slate-300">{e.referenceType}</span>
                  <StatusPill value={e.status} />
                  <span className="font-medium text-white">R{money.format(Number(e.amount ?? 0))}</span>
                  <span className="truncate text-slate-500">{e.id}</span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {e.status === "DISPUTED" ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/admin/payments/escrow/resolve", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ escrowId: e.id, resolution: "release" }),
                            });
                            void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
                          }}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white"
                        >
                          Release
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/admin/payments/escrow/resolve", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ escrowId: e.id, resolution: "refund" }),
                            });
                            void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
                          }}
                          className="rounded-lg bg-red-600 px-2 py-1 text-[10px] font-semibold text-white"
                        >
                          Refund
                        </button>
                      </>
                    ) : null}
                    {linkedTx ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailKind("marketplace");
                          setDetailId(linkedTx.id);
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "trials" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<Landmark className="h-4 w-4 text-cyan-400" />} title="Free trial signups (potential revenue)" />
          <p className="mt-2 text-sm text-slate-400">
            Trial viewers are not charged yet. These rows represent possible monthly subscription revenue if trials convert.
            Trial watch time is excluded from creator revenue pool calculations.
          </p>
          <div className="mt-4 space-y-2">
            {trialSignups.length === 0 ? (
              <p className="text-sm text-slate-500">No trial signups recorded yet.</p>
            ) : null}
            {trialSignups.map((trial) => (
              <div
                key={trial.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 px-3 py-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <p className="font-medium text-white">{trial.userName || trial.userEmail || "Viewer"}</p>
                  <p className="text-slate-500">{trial.userEmail}</p>
                  <p className="mt-1 text-slate-400">
                    {trial.planLabel} · started {new Date(trial.createdAt).toLocaleDateString()}
                    {trial.trialEndsAt ? ` · trial ends ${new Date(trial.trialEndsAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <StatusPill value={trial.isActiveTrial ? "TRIAL_ACTIVE" : trial.status} />
                <span className="font-semibold text-cyan-200">R{money.format(Number(trial.potentialMonthlyRevenue ?? 0))}/mo</span>
                <span className={`rounded-full px-2 py-0.5 ${trial.hasConverted ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                  {trial.hasConverted ? "converted" : "not billed yet"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "cancellations" ? (
        <div className="space-y-6">
          {churnLoading ? <p className="text-sm text-slate-400">Loading cancellation telemetry…</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Subscriptions cancelled" value={String(churnMetrics.subscriptionsCancelled ?? 0)} tone="text-red-300" />
            <Card label="End-of-period cancels" value={String(churnMetrics.subscriptionsScheduledCancel ?? 0)} tone="text-amber-300" />
            <Card label="Past due (viewers)" value={String(churnMetrics.subscriptionsPastDue ?? 0)} tone="text-orange-300" />
            <Card
              label="Failed / cancelled payments"
              value={String(
                Number(churnMetrics.gatewayPaymentsCancelled ?? 0) +
                  Number(churnMetrics.gatewayPaymentsFailed ?? 0) +
                  Number(churnMetrics.marketplaceTransactionsFailed ?? 0),
              )}
              tone="text-red-300"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs">
              <p className="font-semibold text-white">Viewers</p>
              <p className="mt-2 text-slate-400">
                {churnMetrics.viewerCancelled ?? 0} cancelled · {churnMetrics.viewerScheduledCancel ?? 0} scheduled
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs">
              <p className="font-semibold text-white">Company listings</p>
              <p className="mt-2 text-slate-400">
                {churnMetrics.companyCancelled ?? 0} cancelled · {churnMetrics.companyScheduledCancel ?? 0} scheduled
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Crew, casting, locations, equipment, catering</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs">
              <p className="font-semibold text-white">Creators & musicians</p>
              <p className="mt-2 text-slate-400">
                {churnMetrics.creatorCancelled ?? 0} cancelled · {churnMetrics.creatorScheduledCancel ?? 0} scheduled
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Distribution / pipeline licences</p>
            </div>
          </div>

          <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
            <SectionHeader icon={<UserMinus className="h-4 w-4 text-red-400" />} title="Cancelled & at-risk subscriptions" />
            <p className="mt-2 text-xs text-slate-500">
              Viewers, company marketplace listings, and creator distribution licences — including end-of-period cancels still active until renewal date.
            </p>
            <div className="mt-3 space-y-2">
              {cancelledSubscriptions.length === 0 ? (
                <p className="text-sm text-slate-500">No cancelled or scheduled-cancel subscriptions yet.</p>
              ) : null}
              {cancelledSubscriptions.map((row) => (
                <div
                  key={`${row.segmentLabel}-${row.id}`}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 px-3 py-3 text-xs sm:grid-cols-[1.2fr_1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">{row.userName || row.userEmail || "User"}</p>
                    <p className="text-slate-500">{row.userEmail}</p>
                    <p className="mt-0.5 text-slate-400">
                      {row.segmentLabel} · {row.planLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">{row.userRole || "—"}</p>
                    {row.periodEnd ? (
                      <p className="text-[10px] text-slate-500">Access until {new Date(row.periodEnd).toLocaleDateString()}</p>
                    ) : null}
                    {row.lastPaymentError ? <p className="text-[10px] text-red-300">{row.lastPaymentError}</p> : null}
                  </div>
                  <ChurnStatePill value={row.churnState} status={row.status} />
                  <span className="text-slate-500">{new Date(row.updatedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
            <SectionHeader icon={<ClipboardList className="h-4 w-4 text-red-400" />} title="Cancelled & failed transactions" />
            <p className="mt-2 text-xs text-slate-500">
              PayFast checkouts abandoned or cancelled, failed renewals, and marketplace payment failures.
            </p>
            <div className="mt-3 space-y-2">
              {cancelledTransactions.length === 0 ? (
                <p className="text-sm text-slate-500">No cancelled or failed transactions recorded.</p>
              ) : null}
              {cancelledTransactions.map((row) => (
                <div
                  key={`${row.source}-${row.id}`}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 px-3 py-3 text-xs sm:grid-cols-[1.4fr_auto_auto_1fr]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200">{row.purposeLabel || row.source.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 truncate text-slate-500">
                      {row.userName || row.userEmail || "Unknown"} · {row.userRole || "—"}
                      {row.counterpartyName ? ` → ${row.counterpartyName}` : ""}
                    </p>
                    {row.failureReason ? <p className="mt-1 text-[10px] text-red-300">{row.failureReason}</p> : null}
                  </div>
                  <StatusPill value={row.status} />
                  <span className="font-medium text-white">R{money.format(Number(row.amount ?? 0))}</span>
                  <span className="text-slate-500">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "events" ? (
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <SectionHeader icon={<ClipboardList className="h-4 w-4 text-orange-400" />} title="Gateway events" />
          <div className="mt-3 space-y-2">
            {gatewayEvents.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${e.signatureVerified ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  {e.signatureVerified ? "verified" : "unverified"}
                </span>
                <span className="text-slate-300">{e.eventType}</span>
                <span className={`rounded-full px-2 py-0.5 ${e.processed ? "bg-blue-500/10 text-blue-300" : "bg-amber-500/10 text-amber-300"}`}>
                  {e.processed ? "processed" : "pending"}
                </span>
                <span className="truncate text-slate-500">{e.externalEventId || e.id}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <AdminTransactionDetailModal
        kind={detailKind}
        id={detailId}
        onClose={() => {
          setDetailKind(null);
          setDetailId(null);
        }}
      />
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ChurnStatePill({ value, status }: { value: string; status: string }) {
  const label =
    value === "scheduled_cancel"
      ? "Cancel scheduled"
      : value === "past_due"
        ? "Past due"
        : "Cancelled";
  const tone =
    value === "scheduled_cancel"
      ? "bg-amber-500/10 text-amber-300"
      : value === "past_due"
        ? "bg-orange-500/10 text-orange-300"
        : "bg-red-500/10 text-red-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`} title={status}>
      {label}
    </span>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-orange-500 text-white" : "border border-slate-700/60 bg-slate-900/50 text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
      {icon}
      {title}
    </h2>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "SUCCEEDED" || value === "COMPLETED" || value === "PAID"
      ? "bg-emerald-500/10 text-emerald-300"
      : value === "FAILED" || value === "DISPUTED" || value === "DECLINED"
        ? "bg-red-500/10 text-red-300"
        : value === "APPROVED"
          ? "bg-blue-500/10 text-blue-300"
          : "bg-amber-500/10 text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 ${tone}`}>{value}</span>;
}
