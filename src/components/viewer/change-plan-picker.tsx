"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Film,
  Loader2,
  Ticket,
  Tv,
  Users,
} from "lucide-react";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { CheckoutModal } from "@/components/payments/checkout-modal";

const SUBSCRIPTION_PLANS = [
  {
    id: "BASE_1",
    name: VIEWER_PLAN_CONFIG.BASE_1.label,
    price: VIEWER_PLAN_CONFIG.BASE_1.price,
    devices: 1,
    description: "Best for solo viewers",
    benefits: ["Watch on 1 device", "Full catalogue access", "HD streaming"],
  },
  {
    id: "STANDARD_3",
    name: VIEWER_PLAN_CONFIG.STANDARD_3.label,
    price: VIEWER_PLAN_CONFIG.STANDARD_3.price,
    devices: 3,
    description: "Popular for couples and small households",
    benefits: ["Watch on 3 devices", "Full catalogue access", "HD streaming", "Share with family"],
  },
  {
    id: "FAMILY_5",
    name: VIEWER_PLAN_CONFIG.FAMILY_5.label,
    price: VIEWER_PLAN_CONFIG.FAMILY_5.price,
    devices: 5,
    description: "Built for busy households",
    benefits: ["Watch on 5+ devices", "Create 5+ profiles", "Full catalogue access", "Best for households"],
  },
] as const;

type SubscriptionSnapshot = {
  plan: string;
  viewerModel: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

type ChangePlanPickerProps = {
  subscription: SubscriptionSnapshot;
  reactivationMode?: boolean;
  backHref?: string;
};

type QuoteState = Record<string, { chargeAmount: number; chargeType: string; requiresCheckout: boolean }>;

function planKey(viewerModel: string, planId: string) {
  return `${viewerModel}:${planId}`;
}

function isCurrentPlan(subscription: SubscriptionSnapshot, viewerModel: string, planId: string) {
  if (viewerModel === "PPV") {
    return subscription.viewerModel === "PPV";
  }
  return subscription.viewerModel !== "PPV" && subscription.plan === planId;
}

export function ChangePlanPicker({
  subscription,
  reactivationMode = false,
  backHref = "/browse/account",
}: ChangePlanPickerProps) {
  const router = useRouter();
  const [expandedModel, setExpandedModel] = useState<"SUBSCRIPTION" | "PPV" | null>("SUBSCRIPTION");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(subscription.plan);
  const [quotes, setQuotes] = useState<QuoteState>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const isTrial = subscription.status === "TRIAL_ACTIVE";
  const trialEndLabel = subscription.trialEndsAt
    ? new Date(subscription.trialEndsAt).toLocaleDateString()
    : null;
  const trialExpired =
    isTrial && subscription.trialEndsAt && new Date(subscription.trialEndsAt) < new Date();

  const currentPlanLabel = useMemo(() => {
    if (subscription.viewerModel === "PPV") {
      return "Pay Per View";
    }
    const config = VIEWER_PLAN_CONFIG[subscription.plan as keyof typeof VIEWER_PLAN_CONFIG];
    return config?.label ?? subscription.plan;
  }, [subscription.plan, subscription.viewerModel]);

  async function loadQuote(viewerModel: string, plan: string) {
    const key = planKey(viewerModel, plan);
    if (quotes[key]) return quotes[key];
    const res = await fetch(
      `/api/viewer/subscription/change-plan?viewerModel=${encodeURIComponent(viewerModel)}&plan=${encodeURIComponent(plan)}`,
      { cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Unable to load price");
    setQuotes((current) => ({ ...current, [key]: data.quote }));
    return data.quote as { chargeAmount: number; chargeType: string; requiresCheckout: boolean };
  }

  async function handleSelect(viewerModel: "SUBSCRIPTION" | "PPV", plan: string) {
    const key = planKey(viewerModel, plan);
    setError("");
    setLoadingKey(key);
    try {
      const quote = await loadQuote(viewerModel, plan);
      const res = await fetch("/api/viewer/subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerModel, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to change plan");

      if (data.deferCheckout && typeof data.checkoutUrl === "string" && data.checkoutUrl) {
        setCheckoutUrl(data.checkoutUrl);
        setCheckoutOpen(true);
        return;
      }

      router.push(typeof data.redirectTo === "string" ? data.redirectTo : backHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingKey(null);
    }
  }

  function payButtonLabel(viewerModel: string, planId: string, price: number) {
    const key = planKey(viewerModel, planId);
    const quote = quotes[key];
    if (isCurrentPlan(subscription, viewerModel, planId) && !reactivationMode && !trialExpired) {
      return "Current plan";
    }
    if (viewerModel === "PPV") return "Switch to PPV";
    if (quote?.chargeType === "upgrade_delta" && quote.chargeAmount > 0) {
      return `Pay ${formatZar(quote.chargeAmount)} now`;
    }
    if (quote?.requiresCheckout) {
      return `Pay ${formatZar(quote.chargeAmount || price)} now`;
    }
    if (reactivationMode || trialExpired) return `Pay ${formatZar(price)} now`;
    return "Switch plan";
  }

  return (
    <div className="space-y-6">
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        dismissible={false}
        title="Complete subscription payment"
        subtitle="Finish secure payment to activate your selected plan."
        onClose={() => setCheckoutOpen(false)}
      />

      <div className="storytime-section p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current selection</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{currentPlanLabel}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {subscription.viewerModel === "PPV"
                ? "Pay only when you unlock eligible titles."
                : "Full catalogue access on your current package."}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              isTrial && !trialExpired
                ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-200"
                : subscription.status === "ACTIVE"
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                  : "border-orange-400/25 bg-orange-500/10 text-orange-200"
            }`}
          >
            {isTrial && !trialExpired ? "Free trial" : subscription.status}
          </span>
        </div>

        {isTrial && trialEndLabel ? (
          <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-4 text-sm text-cyan-100">
            <p className="flex items-center gap-2 font-medium text-white">
              <CalendarDays className="h-4 w-4" />
              {trialExpired ? "Your free trial has ended" : "Free trial active"}
            </p>
            <p className="mt-1 text-cyan-100/90">
              {trialExpired
                ? "Choose a paid plan below to keep watching without leaving Story Time."
                : `Trial ends ${trialEndLabel}. You can switch to a paid plan now or keep watching until then.`}
            </p>
          </div>
        ) : null}

        {subscription.currentPeriodEnd && !isTrial ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4" />
            Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        ) : null}
      </div>

      {reactivationMode || trialExpired ? (
        <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 p-4 text-sm text-orange-100">
          Select a viewer model and package below, then pay securely to restore access.
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setExpandedModel((current) => (current === "SUBSCRIPTION" ? null : "SUBSCRIPTION"))}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
                <Users className="h-5 w-5 text-orange-300" />
              </div>
              <div>
                <p className="font-semibold text-white">Subscription</p>
                <p className="text-sm text-slate-400">Full catalogue with household profiles</p>
              </div>
            </div>
            {expandedModel === "SUBSCRIPTION" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedModel === "SUBSCRIPTION" ? (
            <div className="space-y-3 border-t border-white/8 px-5 py-4">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const key = planKey("SUBSCRIPTION", plan.id);
                const isCurrent = isCurrentPlan(subscription, "SUBSCRIPTION", plan.id);
                const isExpanded = expandedPlan === plan.id;
                return (
                  <div key={plan.id} className="rounded-xl border border-white/8 bg-black/20">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedPlan((current) => (current === plan.id ? null : plan.id));
                        void loadQuote("SUBSCRIPTION", plan.id).catch(() => undefined);
                      }}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                    >
                      <div>
                        <p className="font-medium text-white">{plan.name}</p>
                        <p className="text-sm text-slate-400">
                          {formatZar(plan.price)}/month · {plan.devices} device{plan.devices > 1 ? "s" : ""}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    {isExpanded ? (
                      <div className="space-y-3 border-t border-white/8 px-4 py-4">
                        <p className="text-sm text-slate-400">{plan.description}</p>
                        <ul className="space-y-2 text-sm text-slate-300">
                          {plan.benefits.map((benefit) => (
                            <li key={benefit} className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-emerald-400" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          disabled={loadingKey === key || (isCurrent && !reactivationMode && !trialExpired)}
                          onClick={() => handleSelect("SUBSCRIPTION", plan.id)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loadingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          {payButtonLabel("SUBSCRIPTION", plan.id, plan.price)}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setExpandedModel((current) => (current === "PPV" ? null : "PPV"))}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
                <Ticket className="h-5 w-5 text-orange-300" />
              </div>
              <div>
                <p className="font-semibold text-white">Pay Per View</p>
                <p className="text-sm text-slate-400">One profile · pay per title</p>
              </div>
            </div>
            {expandedModel === "PPV" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedModel === "PPV" ? (
            <div className="space-y-3 border-t border-white/8 px-5 py-4">
              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">Pay Per View account</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {formatZar(VIEWER_PLAN_CONFIG.PPV_FILM.price)} per title · 30-day access window
                    </p>
                  </div>
                  <Film className="h-5 w-5 text-orange-300" />
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    One viewer profile only
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    Pay only when you unlock a title
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    No monthly subscription fee
                  </li>
                </ul>
                <button
                  type="button"
                  disabled={loadingKey === planKey("PPV", "PPV_FILM") || isCurrentPlan(subscription, "PPV", "PPV_FILM")}
                  onClick={() => handleSelect("PPV", "PPV_FILM")}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingKey === planKey("PPV", "PPV_FILM") ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Tv className="h-4 w-4" />
                  )}
                  {payButtonLabel("PPV", "PPV_FILM", VIEWER_PLAN_CONFIG.PPV_FILM.price)}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      ) : null}

      <Link href={backHref} className="inline-flex text-sm text-slate-400 hover:text-white">
        ← Back to subscription
      </Link>
    </div>
  );
}
