"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, RefreshCw } from "lucide-react";
import { CheckoutModal } from "@/components/payments/checkout-modal";
import {
  CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY,
  CREATOR_ONBOARDING_PLANS,
  formatCreatorLicenseSummary,
} from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { getClientReturnPath } from "@/lib/payments/payfast-card-consent-client";

type LicensePayload = {
  license?: {
    id: string;
    type: string;
    status: string;
    yearlyExpiresAt?: string | null;
    autoRenew?: boolean;
    cancelAtPeriodEnd?: boolean;
    lastPaymentError?: string | null;
  } | null;
  planSummary?: string | null;
  licensePeriodActive?: boolean;
  packageComplete?: boolean;
  packageGateReason?: string | null;
};

type PlanChoice =
  | { package: "PER_FILM" }
  | { package: "UPLOAD_YEARLY" }
  | { package: "PIPELINE"; billing: "YEARLY" | "MONTHLY" };

const PLAN_OPTIONS: Array<{
  key: string;
  title: string;
  price: string;
  body: PlanChoice;
}> = [
  {
    key: "per_film",
    title: CREATOR_ONBOARDING_PLANS.PER_FILM.label,
    price: `${formatZar(CREATOR_ONBOARDING_PLANS.PER_FILM.price)} / film`,
    body: { package: "PER_FILM" },
  },
  {
    key: "upload_yearly",
    title: CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.label,
    price: `${formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price)} / year`,
    body: { package: "UPLOAD_YEARLY" },
  },
  {
    key: "pipeline_yearly",
    title: `${CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.label} (yearly)`,
    price: `${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price)} / year`,
    body: { package: "PIPELINE", billing: "YEARLY" },
  },
  {
    key: "pipeline_monthly",
    title: `${CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.label} (monthly)`,
    price: `${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price)} / month`,
    body: { package: "PIPELINE", billing: "MONTHLY" },
  },
];

export function CreatorBillingPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, "billing"],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()) as Promise<LicensePayload>,
  });

  const [selected, setSelected] = useState<string>("pipeline_yearly");
  const [promoCode, setPromoCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);

  const license = data?.license ?? null;
  const choice = useMemo(
    () => PLAN_OPTIONS.find((p) => p.key === selected)?.body ?? { package: "PIPELINE" as const, billing: "YEARLY" as const },
    [selected],
  );

  async function submitPlan(action: "change_plan" | "renew") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/creator/distribution-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...choice,
          promoCode: promoCode.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to update package");
      await queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
      if (json.checkoutUrl) {
        setCheckoutUrl(json.checkoutUrl);
        setCheckoutOpen(true);
        setMessage("Complete payment to activate the selected package.");
      } else {
        setMessage(
          json.pricing?.promoCode
            ? `Promo ${json.pricing.promoCode} applied. Package is active — no cash charged.`
            : "Package updated.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update package");
    } finally {
      setBusy(false);
    }
  }

  async function manageCancel(cancelAtPeriodEnd: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/creator/distribution-license/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtPeriodEnd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to update renewal");
      await queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
      setMessage(cancelAtPeriodEnd ? "Cancellation scheduled at period end." : "Package cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update renewal");
    } finally {
      setBusy(false);
    }
  }

  async function resumeRenewal() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/creator/distribution-license/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to resume");
      await queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
      setMessage("Auto-renewal resumed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resume");
    } finally {
      setBusy(false);
    }
  }

  async function saveCardForRenewals() {
    setCardBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments/payfast/card-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: getClientReturnPath() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Unable to start card setup");
      if (!json.checkoutUrl) throw new Error("No checkout URL returned");
      setCheckoutUrl(json.checkoutUrl);
      setCheckoutOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start card setup");
    } finally {
      setCardBusy(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading billing…</p>;
  }

  const expired = data?.packageGateReason === "expired" || data?.licensePeriodActive === false;
  const periodLabel = license?.yearlyExpiresAt
    ? new Date(license.yearlyExpiresAt).toLocaleDateString()
    : "No fixed end date";

  return (
    <div className="space-y-6">
      <div className="storytime-section p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Creator package</h2>
          <span
            className={`rounded-full border px-3 py-1 text-sm ${
              license?.status === "ACTIVE" && !expired
                ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-white/[0.06] text-slate-400"
            }`}
          >
            {expired ? "EXPIRED" : license?.status || "NONE"}
          </span>
        </div>
        <p className="mb-1 font-medium text-white">
          {license ? formatCreatorLicenseSummary(license.type) : data?.planSummary || "No package selected"}
        </p>
        <p className="text-sm text-slate-400">
          {license?.cancelAtPeriodEnd ? "Access until" : "Renews / ends"} {periodLabel}
          {license?.autoRenew === false ? " · auto-renew off" : ""}
        </p>
        {license?.lastPaymentError ? (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {license.lastPaymentError}
          </p>
        ) : null}
        {expired ? (
          <p className="mt-3 text-sm text-amber-200">
            Your package period has ended. Choose a plan below (or apply a valid promo) to restore access.
          </p>
        ) : null}
      </div>

      <div className="storytime-section p-6">
        <h3 className="mb-3 text-base font-semibold text-white">Change plan / pay again</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAN_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelected(opt.key)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected === opt.key
                  ? "border-orange-400/40 bg-orange-500/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <p className="font-medium">{opt.title}</p>
              <p className="mt-1 text-xs text-slate-400">{opt.price}</p>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm text-slate-400">
          Promo code (optional)
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            placeholder="Enter promo"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitPlan(license ? "change_plan" : "change_plan")}
            className="inline-flex items-center rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {license ? "Switch & pay" : "Select package"}
          </button>
          <button
            type="button"
            disabled={cardBusy}
            onClick={() => void saveCardForRenewals()}
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.07] disabled:opacity-60"
          >
            {cardBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Save card for auto-renew
          </button>
        </div>
        {license?.status === "ACTIVE" && !license.cancelAtPeriodEnd ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void manageCancel(true)}
            className="mt-3 text-sm text-amber-300 underline-offset-2 hover:underline"
          >
            Cancel auto-renewal at period end
          </button>
        ) : null}
        {license?.cancelAtPeriodEnd ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void resumeRenewal()}
            className="mt-3 text-sm text-emerald-300 underline-offset-2 hover:underline"
          >
            Resume auto-renewal
          </button>
        ) : null}
        {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>

      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        title="Complete creator package payment"
        subtitle="Pay securely with PayFast. Your card can be saved for renewals."
        onClose={() => setCheckoutOpen(false)}
      />
    </div>
  );
}
