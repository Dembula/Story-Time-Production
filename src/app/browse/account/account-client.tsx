"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Smartphone, Calendar, RefreshCw, Film, Loader2 } from "lucide-react";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";

type Subscription = {
  id: string;
  viewerModel: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  deviceCount: number;
  profileLimit: number | null;
  billingEmail?: string | null;
  paymentMethodLabel?: string | null;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string | null;
  lastPaymentError?: string | null;
  activePpvTitles: number;
  payments: { amount: number; status: string; paidAt: string | null }[];
} | null;

const PLAN_LABELS: Record<string, string> = {
  BASE_1: `${VIEWER_PLAN_CONFIG.BASE_1.label} (1 device/profile) - ${formatZar(VIEWER_PLAN_CONFIG.BASE_1.price)}/mo`,
  STANDARD_3: `${VIEWER_PLAN_CONFIG.STANDARD_3.label} (3 devices/profiles) - ${formatZar(VIEWER_PLAN_CONFIG.STANDARD_3.price)}/mo`,
  FAMILY_5: `${VIEWER_PLAN_CONFIG.FAMILY_5.label} (5+ devices/profiles) - ${formatZar(VIEWER_PLAN_CONFIG.FAMILY_5.price)}/mo`,
  PPV_FILM: `Pay Per View - ${formatZar(VIEWER_PLAN_CONFIG.PPV_FILM.price)} per title`,
};

export function AccountClient({ subscription }: { subscription: Subscription }) {
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const isActive = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIAL_ACTIVE");
  const isTrial = subscription?.status === "TRIAL_ACTIVE";
  const isPpv = subscription?.viewerModel === "PPV";
  const canManageSubscription = !isPpv && isActive;

  async function retryRenewal() {
    setRenewError("");
    setRenewing(true);
    try {
      const res = await fetch("/api/viewer/subscription/renew", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Renewal failed");
      window.location.reload();
    } catch (error) {
      setRenewError(error instanceof Error ? error.message : "Renewal failed");
    } finally {
      setRenewing(false);
    }
  }

  async function manageCancellation(cancelAtPeriodEnd: boolean) {
    setCancelMessage("");
    setCancelLoading(true);
    try {
      const res = await fetch("/api/viewer/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtPeriodEnd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to update subscription");
      setCancelMessage(data.message || (cancelAtPeriodEnd ? "Cancellation scheduled." : "Subscription cancelled."));
      window.location.reload();
    } catch (error) {
      setCancelMessage(error instanceof Error ? error.message : "Unable to update subscription");
    } finally {
      setCancelLoading(false);
    }
  }

  async function resumeSubscription() {
    setCancelLoading(true);
    setCancelMessage("");
    try {
      const res = await fetch("/api/viewer/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to resume subscription");
      window.location.reload();
    } catch (error) {
      setCancelMessage(error instanceof Error ? error.message : "Unable to resume subscription");
    } finally {
      setCancelLoading(false);
    }
  }

  if (!subscription) {
    return (
      <div className="storytime-section p-8 text-center">
        <CreditCard className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No active subscription</h2>
        <p className="text-slate-400 mb-6">Choose a plan to start watching.</p>
        <Link href="/onboarding/package" className="inline-flex rounded-xl viewer-btn-primary px-6 py-3 font-semibold transition hover:-translate-y-0.5">
          Choose a plan
        </Link>
      </div>
    );
  }

  const subscriptionEnded = !isActive;

  return (
    <div className="space-y-6">
      {subscriptionEnded && (
        <div className="rounded-2xl border border-orange-400/28 bg-orange-500/10 p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-white mb-1">Your subscription has ended</h2>
          <p className="text-slate-300 text-sm mb-4">Pay below to resume watching. Choose a plan and complete payment to restore your account.</p>
          <Link href="/browse/account/renew" className="inline-flex rounded-xl viewer-btn-primary px-5 py-2.5 font-semibold transition hover:-translate-y-0.5">
            Pay &amp; resume subscription
          </Link>
        </div>
      )}
      <div className="storytime-section p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{isPpv ? "Current viewer model" : "Current plan"}</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive ? "bg-emerald-500/18 text-emerald-300 border border-emerald-400/18" : "bg-white/[0.06] text-slate-400 border border-white/8"
          }`}>
            {isPpv ? "PPV" : isTrial ? "Free trial" : subscription.status}
          </span>
        </div>
        <p className="text-white font-medium mb-2">{PLAN_LABELS[subscription.plan] ?? subscription.plan}</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> {subscription.deviceCount} device{subscription.deviceCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" /> {subscription.profileLimit ?? subscription.deviceCount} profile{(subscription.profileLimit ?? subscription.deviceCount) !== 1 ? "s" : ""}
          </span>
          {isPpv && (
            <span className="flex items-center gap-1.5">
              <Film className="w-4 h-4" /> {subscription.activePpvTitles} active film unlock{subscription.activePpvTitles !== 1 ? "s" : ""}
            </span>
          )}
          {subscription.trialEndsAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
            </span>
          )}
          {subscription.currentPeriodEnd && !isTrial && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />{" "}
              {subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </span>
          )}
          {subscription.cancelAtPeriodEnd ? (
            <span className="text-amber-300 text-sm">Cancellation scheduled at period end</span>
          ) : null}
          {subscription.paymentMethodLabel && (
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4" /> {subscription.paymentMethodLabel}
            </span>
          )}
        </div>
        {subscription.lastPaymentError ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {subscription.lastPaymentError}
          </div>
        ) : null}
        {renewError ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {renewError}
          </div>
        ) : null}
        {cancelMessage ? (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {cancelMessage}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/onboarding/package" className="inline-flex items-center gap-2 rounded-xl bg-orange-500/12 px-4 py-2.5 text-sm font-medium text-orange-300 hover:bg-orange-500/18">
            <RefreshCw className="w-4 h-4" /> {isPpv ? "Change viewer model" : "Change plan"}
          </Link>
          {!isPpv && (
            <button
              type="button"
              onClick={retryRenewal}
              disabled={renewing || !subscription.paymentMethodLabel}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
            >
              {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Retry saved-card renewal
            </button>
          )}
          {!isPpv && !subscription.paymentMethodLabel ? (
            <Link href="/browse/account/renew" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]">
              Add payment method
            </Link>
          ) : null}
          {canManageSubscription && !subscription.cancelAtPeriodEnd ? (
            <button
              type="button"
              onClick={() => manageCancellation(true)}
              disabled={cancelLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-50"
            >
              Cancel at period end
            </button>
          ) : null}
          {canManageSubscription && subscription.cancelAtPeriodEnd ? (
            <button
              type="button"
              onClick={resumeSubscription}
              disabled={cancelLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
            >
              Keep subscription
            </button>
          ) : null}
        </div>
      </div>
      {subscription.payments.length > 0 && (
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent payments</h2>
          <ul className="space-y-2">
            {subscription.payments.map((p, i) => (
              <li key={i} className="flex justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="text-slate-300">{formatZar(p.amount)}</span>
                <span className={p.status === "COMPLETED" ? "text-emerald-400" : "text-slate-500"}>{p.status}</span>
                {p.paidAt && <span className="text-slate-500">{new Date(p.paidAt).toLocaleDateString()}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
