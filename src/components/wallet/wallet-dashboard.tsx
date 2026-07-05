"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PAYEE_DASHBOARD_REFETCH_MS } from "@/lib/dashboard-refresh";
import { PayoutKycBanner } from "@/components/payout-kyc/payout-kyc-banner";
import { requiresPayoutKyc } from "@/lib/payout-kyc-shared";
import { FunderVerificationBanner } from "@/components/funders/funder-verification-banner";
import { getClientReturnPath } from "@/lib/payments/payfast-card-consent-client";
import { useCardSaveReturnRefresh } from "@/lib/hooks/use-card-save-return";
import { getAccountRouteForRole, getWalletRouteForRole } from "@/lib/wallet-route";
import { EscrowActions } from "@/components/wallet/escrow-actions";

const money = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function WalletDashboard({
  title = "Wallet",
  subtitle = "Manage balance, payouts, escrow, and transaction history.",
}: {
  title?: string;
  subtitle?: string;
}) {
  async function readJsonOrThrow(res: Response) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || "Request failed");
    }
    return data;
  }

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cardSavedNotice, setCardSavedNotice] = useState(false);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["wallet-page"],
    queryFn: async () => {
      const res = await fetch("/api/wallet");
      return readJsonOrThrow(res);
    },
    refetchInterval: PAYEE_DASHBOARD_REFETCH_MS,
  });
  const refreshAfterCardSave = useCallback(() => {
    void refetch();
    setCardSavedNotice(true);
  }, [refetch]);
  useCardSaveReturnRefresh(refreshAfterCardSave);
  const filterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: { type: typeFilter || undefined, status: statusFilter || undefined } }),
      });
      return readJsonOrThrow(res);
    },
  });
  const payoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payments/payouts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.max(0, Number(data?.wallet?.availableBalance ?? 0)) }),
      });
      return readJsonOrThrow(res);
    },
    onSuccess: () => refetch(),
  });
  const payfastCardMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payments/payfast/card-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: getClientReturnPath(walletReturnPath) }),
      });
      const payload = await readJsonOrThrow(res);
      if (payload.checkoutUrl) window.location.href = payload.checkoutUrl;
      return payload;
    },
  });
  const payfastUpdateCardMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payments/payfast/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: getClientReturnPath(walletReturnPath) }),
      });
      const payload = await readJsonOrThrow(res);
      if (payload.updateUrl) window.location.href = payload.updateUrl;
      return payload;
    },
  });

  const wallet = data?.wallet;
  const transactions = useMemo(
    () => (filterMutation.data?.transactions as any[] | undefined) ?? (data?.transactions as any[] | undefined) ?? [],
    [data?.transactions, filterMutation.data?.transactions],
  );
  const escrows = (data?.escrows as any[] | undefined) ?? [];
  const payouts = (wallet?.payoutRequests as any[] | undefined) ?? [];
  const payfastCard = data?.payfastCard as { hasToken?: boolean } | undefined;
  const payoutBanking = data?.payoutBanking as
    | { bankName?: string; accountNumberMasked?: string; accountType?: string }
    | null
    | undefined;
  const { data: session } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id ?? "";
  const walletReturnPath = getWalletRouteForRole(role);
  const payoutKycStatus = (session?.user as { payoutKycVerificationStatus?: string })?.payoutKycVerificationStatus;
  const funderStatus = (session?.user as { funderVerificationStatus?: string })?.funderVerificationStatus;
  const isFunder = role === "FUNDER";
  const payoutsUnlocked =
    (!requiresPayoutKyc(role) || payoutKycStatus === "APPROVED") &&
    (!isFunder || funderStatus === "APPROVED");
  const bankingHref = getAccountRouteForRole(role);
  const verificationHref = bankingHref;
  const verificationLabel = isFunder ? "funder verification" : "payout verification";

  return (
    <main className="space-y-6 text-slate-100">
      <section className="storytime-section p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </section>

      {requiresPayoutKyc(role) ? <PayoutKycBanner inline /> : null}
      {isFunder ? <FunderVerificationBanner inline /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card label="Available" value={`R${money.format(Number(wallet?.availableBalance ?? 0))}`} />
        <Card label="Pending" value={`R${money.format(Number(wallet?.pendingBalance ?? 0))}`} />
        <Card label="Locked" value={`R${money.format(Number(wallet?.lockedBalance ?? 0))}`} />
        <Card label="Total earnings" value={`R${money.format(Number(wallet?.totalEarnings ?? 0))}`} />
      </section>

      <section className="storytime-section p-6">
        <h2 className="text-lg font-semibold">Transaction history</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} placeholder="Filter type" className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs" />
          <input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Filter status" className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs" />
          <button onClick={() => filterMutation.mutate()} className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400">Apply filters</button>
        </div>
        <div className="mt-3 space-y-2">
          {isLoading ? <p className="text-sm text-slate-400">Loading...</p> : null}
          {filterMutation.error ? <p className="text-sm text-red-400">{(filterMutation.error as Error).message}</p> : null}
          {data?.message ? <p className="text-xs text-amber-300">{data.message as string}</p> : null}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
              <span>{tx.transactionType}</span>
              <span>{tx.direction}</span>
              <span>{tx.status}</span>
              <span>R{money.format(Number(tx.amount ?? 0))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold">Marketplace payments</h2>
          {cardSavedNotice ? (
            <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Card saved successfully. Marketplace checkout can now use your PayFast card.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">
            Marketplace checkout uses your wallet first, then a PayFast-saved card, then hosted checkout.
          </p>
          {payfastCard?.hasToken ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-emerald-300">PayFast card on file — marketplace charges can use your saved card.</p>
              <button
                type="button"
                onClick={() => payfastUpdateCardMutation.mutate()}
                disabled={payfastUpdateCardMutation.isPending}
                className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
              >
                {payfastUpdateCardMutation.isPending ? "Redirecting…" : "Update card on PayFast"}
              </button>
              {payfastUpdateCardMutation.error ? (
                <p className="text-sm text-red-400">{(payfastUpdateCardMutation.error as Error).message}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-amber-200">
                No PayFast card saved. Add one to pay equipment, crew, cast, locations, and catering without leaving Story Time.
              </p>
              <button
                type="button"
                onClick={() => payfastCardMutation.mutate()}
                disabled={payfastCardMutation.isPending}
                className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
              >
                {payfastCardMutation.isPending ? "Redirecting…" : "Add card via PayFast"}
              </button>
              {payfastCardMutation.error ? (
                <p className="text-sm text-red-400">{(payfastCardMutation.error as Error).message}</p>
              ) : null}
            </div>
          )}
        </div>
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold">Payout banking</h2>
          <p className="mt-1 text-xs text-slate-400">
            Withdrawals are reviewed manually by admin. Bank details come from your verified profile — not entered here.
          </p>
          {payoutBanking?.bankName ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-3 text-xs text-slate-300">
              <p>{payoutBanking.bankName}</p>
              <p className="mt-1 font-mono">{payoutBanking.accountNumberMasked}</p>
              <p className="mt-1 text-slate-500">{payoutBanking.accountType}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
              Bank details required before you can request a payout.{" "}
              <Link href={bankingHref} className="font-semibold text-orange-300 underline hover:text-orange-200">
                Add banking details
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold">Payouts</h2>
          <p className="mt-1 text-xs text-slate-400">
            Withdrawals require approved verification. You can still view balances and use the platform while review is in progress.
          </p>
          {payoutsUnlocked ? (
            <button
              type="button"
              onClick={() => payoutMutation.mutate()}
              disabled={
                payoutMutation.isPending ||
                Number(wallet?.availableBalance ?? 0) <= 0 ||
                !payoutBanking?.bankName
              }
              className="mt-3 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              Request payout (available balance)
            </button>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
              Payout requests are disabled until your {verificationLabel} is approved.{" "}
              <Link href={verificationHref} className="font-semibold text-orange-300 underline hover:text-orange-200">
                Complete or view verification
              </Link>
            </div>
          )}
          {payoutMutation.error ? <p className="mt-2 text-sm text-red-400">{(payoutMutation.error as Error).message}</p> : null}
          <div className="mt-3 space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                <span>{p.status}</span>
                <span>R{money.format(Number(p.amount ?? 0))}</span>
                <span>{p.provider}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold">Escrow accounts</h2>
          <div className="mt-3 space-y-2">
            {escrows.length === 0 ? (
              <p className="text-xs text-slate-500">No escrow holds yet.</p>
            ) : null}
            {escrows.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">{e.referenceType}</span>
                  <span className={e.status === "DISPUTED" ? "text-amber-300" : "text-slate-400"}>{e.status}</span>
                  <span className="font-medium text-white">R{money.format(Number(e.amount ?? 0))}</span>
                </div>
                <EscrowActions
                  escrow={{
                    id: e.id,
                    referenceType: e.referenceType,
                    referenceId: e.referenceId,
                    status: e.status,
                    amount: Number(e.amount ?? 0),
                    buyerUserId: e.buyerWallet?.userId,
                    sellerUserId: e.sellerWallet?.userId,
                  }}
                  currentUserId={userId}
                  isAdmin={role === "ADMIN"}
                  onUpdated={() => void refetch()}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="storytime-kpi p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
