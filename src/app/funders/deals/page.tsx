"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useFunderVerificationState } from "@/components/funders/funder-verification-banner";
import { MarketplaceCheckoutModal } from "@/components/marketplace/marketplace-checkout-modal";
import { useMarketplacePay } from "@/lib/hooks/use-marketplace-pay";
import { computeMarketplaceCheckoutTotals } from "@/lib/marketplace-zar-defaults";
import { formatZar } from "@/lib/format-currency-zar";

type DealRow = {
  id: string;
  pipelineStatus: string;
  opportunity?: { title?: string | null; fundingTarget?: number | null } | null;
  creatorUser?: { name?: string | null; professionalName?: string | null } | null;
  termSheets?: Array<{ investmentAmount?: number | null; status?: string | null }>;
  contracts?: Array<{ id: string; status: string; signedByCreator: boolean; signedByInvestor: boolean }>;
  payments?: Array<{ id: string; amount: number; status: string; settledAt?: string | null }>;
  negotiationMessages?: Array<{ id: string; message: string; createdAt: string }>;
};

export default function FunderDealsPage() {
  const qc = useQueryClient();
  const [messageByDeal, setMessageByDeal] = useState<Record<string, string>>({});
  const [payMessage, setPayMessage] = useState("");
  const { data } = useQuery({
    queryKey: ["funder-deals"],
    queryFn: async () => fetch("/api/funders/deals").then((r) => r.json()),
  });
  const mutate = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      fetch("/api/funders/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funder-deals"] }),
  });
  const deals = (data?.deals ?? []) as DealRow[];
  const { investingUnlocked } = useFunderVerificationState();
  const marketplacePay = useMarketplacePay({
    onPaid: () => {
      setPayMessage("Investment payment recorded. Creator receives funds via Story Time payout flow.");
      qc.invalidateQueries({ queryKey: ["funder-deals"] });
    },
  });

  const fundableDeals = useMemo(
    () => deals.filter((d) => ["SIGNING", "CONTRACT_PENDING"].includes(d.pipelineStatus)),
    [deals],
  );

  async function fundDeal(dealId: string) {
    setPayMessage("");
    try {
      const result = await marketplacePay.pay(`/api/funders/deals/${dealId}/pay`);
      if (result?.mode === "wallet") {
        const total =
          typeof result.data.totalAmount === "number"
            ? formatZar(result.data.totalAmount)
            : "paid";
        setPayMessage(`Investment funded (${total} incl. Story Time fee). Receipt saved to your transaction history.`);
        qc.invalidateQueries({ queryKey: ["funder-deals"] });
      }
    } catch (e) {
      setPayMessage(e instanceof Error ? e.message : "Payment failed");
    }
  }

  return (
    <main className="space-y-5 text-slate-100">
      <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-panel">
        <h1 className="text-2xl font-semibold">Deal Engine</h1>
        <p className="mt-1 text-sm text-slate-400">
          Negotiate terms, sign contracts, and fund creators through Story Time. A 3% platform fee is included at checkout; PayFast processing is handled by the platform.
        </p>
        {!investingUnlocked ? (
          <p className="mt-3 text-xs text-amber-300/90">
            You can view and message on deals anytime. Funding actions unlock after{" "}
            <Link href="/funders/verification" className="underline hover:text-amber-200">
              verification is approved
            </Link>
            .
          </p>
        ) : null}
        {payMessage ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {payMessage}
          </p>
        ) : null}
      </section>

      <div className="space-y-3">
        {deals.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-400">
            No active deals yet. Start by expressing interest from the Opportunities page.
          </div>
        ) : null}
        {deals.map((deal) => {
          const baseAmount = deal.termSheets?.[0]?.investmentAmount ?? deal.opportunity?.fundingTarget ?? 0;
          const totals = baseAmount > 0 ? computeMarketplaceCheckoutTotals(baseAmount) : null;
          const latestContract = deal.contracts?.[0];
          const settledPayment = deal.payments?.find((p) => p.status === "SETTLED");
          const canFund =
            investingUnlocked &&
            !settledPayment &&
            ["SIGNING", "CONTRACT_PENDING"].includes(deal.pipelineStatus);
          const creatorName =
            deal.creatorUser?.professionalName || deal.creatorUser?.name || "Creator";

          return (
            <div key={deal.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{deal.opportunity?.title ?? "Untitled opportunity"}</h2>
                  <p className="text-xs text-slate-400">
                    With {creatorName} · Status: {deal.pipelineStatus.replaceAll("_", " ")}
                  </p>
                  {totals ? (
                    <p className="mt-1 text-xs text-orange-300">
                      Investment {formatZar(totals.baseAmount)} + fee {formatZar(totals.feeAmount)} ={" "}
                      {formatZar(totals.totalAmount)} checkout
                    </p>
                  ) : null}
                  {settledPayment ? (
                    <p className="mt-1 text-xs text-emerald-300">
                      Funded {formatZar(settledPayment.amount)} · settled{" "}
                      {settledPayment.settledAt ? new Date(settledPayment.settledAt).toLocaleDateString() : ""}
                    </p>
                  ) : null}
                  {latestContract ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Contract: {latestContract.status}
                      {latestContract.signedByCreator && latestContract.signedByInvestor
                        ? " · fully signed"
                        : ` · creator ${latestContract.signedByCreator ? "signed" : "pending"}, funder ${latestContract.signedByInvestor ? "signed" : "pending"}`}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canFund ? (
                    <button
                      type="button"
                      disabled={marketplacePay.paying || baseAmount <= 0}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => fundDeal(deal.id)}
                    >
                      {marketplacePay.paying ? "Processing…" : "Fund deal"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-900/20"
                    onClick={() =>
                      mutate.mutate({
                        action: "DECIDE_DEAL",
                        dealId: deal.id,
                        status: "REJECTED",
                        rejectionReason: "Risk profile mismatch.",
                      })
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={!investingUnlocked}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => mutate.mutate({ action: "GENERATE_CONTRACT", dealId: deal.id })}
                  >
                    Generate contract
                  </button>
                  <button
                    type="button"
                    disabled={!investingUnlocked}
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => mutate.mutate({ action: "SIGN_CONTRACT", dealId: deal.id })}
                  >
                    Sign
                  </button>
                  <Link
                    href="/funders/programs"
                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.05]"
                  >
                    Programs
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={messageByDeal[deal.id] ?? ""}
                  onChange={(e) => setMessageByDeal((prev) => ({ ...prev, [deal.id]: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Discuss terms with creator..."
                />
                <button
                  className="rounded bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                  onClick={() =>
                    mutate.mutate({
                      action: "SEND_MESSAGE",
                      dealId: deal.id,
                      message: messageByDeal[deal.id] || "Term discussion started.",
                    })
                  }
                >
                  Send
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {fundableDeals.length > 0 && investingUnlocked ? (
        <p className="text-[11px] text-slate-500">
          {fundableDeals.length} deal(s) ready for funding after contract signing. Funds are held by Story Time and paid out to creators per KYC/KYB verification.
        </p>
      ) : null}

      <MarketplaceCheckoutModal
        open={marketplacePay.checkoutOpen}
        checkoutUrl={marketplacePay.checkoutUrl}
        onClose={marketplacePay.closeCheckout}
        title="Investment checkout"
      />
    </main>
  );
}
