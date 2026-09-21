"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { CheckoutModal } from "@/components/payments/checkout-modal";
import { getClientReturnPath } from "@/lib/payments/payfast-card-consent-client";
import { useCardSaveReturnRefresh } from "@/lib/hooks/use-card-save-return";

type SavedCardStatus = {
  configured: boolean;
  hasToken: boolean;
  label?: string | null;
  lastFour?: string | null;
  cardType?: string | null;
};

/**
 * Shared PayFast card save/update block for creator, company, funder, and marketplace profiles.
 * Starts an R5 verification tokenization (subscription_type=2); the R5 is refunded after the card is saved.
 */
export function PayFastSavedCardSection({
  returnPath,
  title = "Billing card (PayFast)",
  description = "Save a card once through PayFast to pay Story Time packages and renewals. A R5 verification charge is taken and refunded after the card is saved. This is not your KYC/KYB payout banking.",
  className = "",
}: {
  returnPath?: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState<"save" | "update" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["payfast-saved-card"],
    queryFn: async () => {
      const res = await fetch("/api/payments/payfast/saved-card", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to load card status");
      return data as SavedCardStatus;
    },
  });

  const refresh = useCallback(() => {
    void statusQuery.refetch();
    setNotice("Card saved successfully. Renewals can use this card when the billing cycle ends.");
  }, [statusQuery]);

  useCardSaveReturnRefresh(refresh);

  async function startSave() {
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/payments/payfast/card-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: getClientReturnPath(returnPath) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to start card setup");
      if (!data.checkoutUrl) throw new Error("No checkout URL returned");
      setCheckoutUrl(data.checkoutUrl as string);
      setCheckoutOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start card setup");
    } finally {
      setBusy(null);
    }
  }

  async function startUpdate() {
    setBusy("update");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/payments/payfast/update-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: getClientReturnPath(returnPath) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to open card update");
      if (!data.updateUrl) throw new Error("No update URL returned");
      window.location.href = data.updateUrl as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open card update");
      setBusy(null);
    }
  }

  const status = statusQuery.data;
  const hasToken = Boolean(status?.hasToken);
  const configured = status?.configured !== false;

  return (
    <section
      id="payfast-saved-card"
      className={`scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.03] p-6 ${className}`}
    >
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        dismissible
        title="Save your card with PayFast"
        subtitle="PayFast will charge R5.00 to verify your card, then we refund that R5 once the card is saved. Your bank may ask for 3D Secure."
        onClose={() => setCheckoutOpen(false)}
      />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-500/10">
          <CreditCard className="h-5 w-5 text-orange-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100/90">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
        <p>
          PayFast shows <span className="font-medium text-sky-50">ZAR R 5.00</span> for card verification.
          Complete 3D Secure when your bank asks. That R5 is refunded after your card is saved — it is not a
          subscription charge. This never replaces KYC/KYB bank documents used for payouts.
        </p>
      </div>

      {statusQuery.isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking card status…
        </p>
      ) : null}

      {!configured ? (
        <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          PayFast is not configured on this environment yet. Card saving will be available once live billing is connected.
        </p>
      ) : null}

      {hasToken ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-emerald-300">
            Card on file
            {status?.label ? ` · ${status.label}` : ""}
            {status?.lastFour ? ` · ••••${status.lastFour}` : ""}.
            Renewals and marketplace charges can use this token.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void startUpdate()}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-60"
          >
            {busy === "update" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Update card on PayFast
          </button>
        </div>
      ) : configured ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-amber-100/90">
            No reusable card saved yet. Add one so listing plans, licenses, and marketplace bookings can renew or charge without starting over.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void startSave()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Save card via PayFast
          </button>
        </div>
      ) : null}

      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {statusQuery.error ? (
        <p className="mt-3 text-sm text-red-300">{(statusQuery.error as Error).message}</p>
      ) : null}
    </section>
  );
}
