"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SecureFileLink } from "@/components/files/secure-file-link";

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

export type AdminPayoutRow = {
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
  paidAt?: string | null;
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

export function resolvePayoutBanking(p: AdminPayoutRow): PayoutBanking | null {
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

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "PAID"
      ? "bg-emerald-500/15 text-emerald-300"
      : value === "APPROVED" || value === "PROCESSING"
        ? "bg-cyan-500/15 text-cyan-300"
        : value === "DECLINED" || value === "FAILED"
          ? "bg-red-500/15 text-red-300"
          : "bg-amber-500/15 text-amber-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{value}</span>;
}

export function AdminPayoutRequestsPanel({
  queryKey = ["admin-payout-requests"],
}: {
  queryKey?: string[];
}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [proofReference, setProofReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, statusFilter],
    queryFn: async () => {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/admin/payouts${qs}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load payout requests");
      return json as { payouts: AdminPayoutRow[] };
    },
  });

  const payouts = data?.payouts ?? [];
  const selectedPayout = payouts.find((p) => p.id === selectedPayoutId) ?? null;

  const queueSummary = useMemo(() => {
    const pending = payouts.filter((p) => p.status === "PENDING_REVIEW").length;
    const approved = payouts.filter((p) => p.status === "APPROVED" || p.status === "PROCESSING").length;
    const paid = payouts.filter((p) => p.status === "PAID").length;
    return { pending, approved, paid };
  }, [payouts]);

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
      if (!res.ok) throw new Error((json as { error?: string }).error || "Payout action failed");
      return json;
    },
    onSuccess: () => {
      setActionError(null);
      setDeclineReason("");
      setProofReference("");
      setProofUrl("");
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (err: Error) => setActionError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Pending review" value={String(queueSummary.pending)} tone="text-amber-300" />
        <SummaryCard label="Approved / processing" value={String(queueSummary.approved)} tone="text-cyan-300" />
        <SummaryCard label="Paid" value={String(queueSummary.paid)} tone="text-emerald-300" />
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "PENDING_REVIEW", "APPROVED", "PAID", "DECLINED"].map((status) => (
          <button
            key={status || "all"}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              statusFilter === status
                ? "bg-orange-500 text-white"
                : "border border-slate-700 bg-slate-900/50 text-slate-400 hover:text-white"
            }`}
          >
            {status ? status.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-slate-400">Loading payout requests…</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ArrowRight className="h-4 w-4 text-orange-400" />
            Creator payout requests
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Review withdrawal requests, confirm the linked bank account, approve, then mark paid with proof.
          </p>
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
                  <p className="text-slate-500">
                    {p.user?.role} · {p.user?.email} · {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="font-semibold text-white">R{money.format(Number(p.amount ?? 0))}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="creator-glass-panel rounded-2xl border border-white/10 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-orange-400" />
            Review &amp; proof
          </h2>
          {!selectedPayout ? (
            <p className="mt-3 text-sm text-slate-500">Select a payout request to review banking and mark paid.</p>
          ) : (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <p className="font-medium text-white">{selectedPayout.user?.name || "—"}</p>
                <p className="text-slate-400">{selectedPayout.user?.email}</p>
                <p className="mt-2 text-lg font-semibold text-orange-300">
                  R{money.format(selectedPayout.amount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Status: {selectedPayout.status}</p>
                {selectedPayout.declineReason ? (
                  <p className="mt-2 text-xs text-red-300">Declined: {selectedPayout.declineReason}</p>
                ) : null}
                {selectedPayout.proofReference ? (
                  <p className="mt-2 text-xs text-emerald-300">Proof ref: {selectedPayout.proofReference}</p>
                ) : null}
                {selectedPayout.proofUrl ? (
                  <SecureFileLink
                    fileRef={selectedPayout.proofUrl}
                    label="View proof document"
                    context="admin"
                    className="mt-1 block text-xs text-cyan-300 underline"
                  />
                ) : null}
              </div>

              {(() => {
                const banking = resolvePayoutBanking(selectedPayout);
                if (!banking) {
                  return (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      No banking details on file. Ask them to complete payout verification before paying out.
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/90">
                      Pay to (linked account)
                    </p>
                    <p>
                      <span className="text-slate-500">Bank:</span> {banking.bankName || "—"}
                    </p>
                    <p>
                      <span className="text-slate-500">Holder:</span> {banking.accountHolderName || "—"}
                    </p>
                    <p className="font-mono text-base tracking-wide text-white">{banking.accountNumber || "—"}</p>
                    <p className="font-mono text-slate-200">Branch {banking.branchCode || "—"}</p>
                    <p className="text-slate-400">Type: {banking.accountType || "—"}</p>
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
                  Approve payout
                </button>
              ) : null}

              {["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(selectedPayout.status) ? (
                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <label className="block">
                    <span className="text-xs text-slate-500">Decline reason (shown to creator)</span>
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
                    Decline &amp; release funds
                  </button>
                </div>
              ) : null}

              {selectedPayout.status === "APPROVED" || selectedPayout.status === "PROCESSING" ? (
                <div className="space-y-2 border-t border-slate-800 pt-4">
                  <label className="block">
                    <span className="text-xs text-slate-500">EFT / payment reference (sent to creator)</span>
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
                    Mark paid &amp; send proof to creator
                  </button>
                </div>
              ) : null}

              {actionError ? <p className="text-xs text-red-400">{actionError}</p> : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
