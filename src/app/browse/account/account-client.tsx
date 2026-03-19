"use client";

import Link from "next/link";
import { CreditCard, Smartphone, Calendar, RefreshCw } from "lucide-react";

type Subscription = {
  id: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  deviceCount: number;
  payments: { amount: number; status: string; paidAt: string | null }[];
} | null;

const PLAN_LABELS: Record<string, string> = {
  BASE_1: "Base (1 device) — R39/mo",
  STANDARD_3: "Standard (3 devices) — R79/mo",
  FAMILY_5: "Family (5+ devices) — R99/mo",
};

export function AccountClient({ subscription }: { subscription: Subscription }) {
  const isActive = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIAL_ACTIVE");
  const isTrial = subscription?.status === "TRIAL_ACTIVE";

  if (!subscription) {
    return (
      <div className="storytime-section p-8 text-center">
        <CreditCard className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">No active subscription</h2>
        <p className="text-slate-400 mb-6">Choose a plan to start watching.</p>
        <Link href="/onboarding/package" className="inline-flex rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
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
          <Link href="/browse/account/renew" className="inline-flex rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
            Pay &amp; resume subscription
          </Link>
        </div>
      )}
      <div className="storytime-section p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Current plan</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive ? "bg-emerald-500/18 text-emerald-300 border border-emerald-400/18" : "bg-white/[0.06] text-slate-400 border border-white/8"
          }`}>
            {isTrial ? "Free trial" : subscription.status}
          </span>
        </div>
        <p className="text-white font-medium mb-2">{PLAN_LABELS[subscription.plan] ?? subscription.plan}</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> {subscription.deviceCount} device{subscription.deviceCount !== 1 ? "s" : ""}
          </span>
          {subscription.trialEndsAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
            </span>
          )}
          {subscription.currentPeriodEnd && !isTrial && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <Link href="/onboarding/package" className="inline-flex items-center gap-2 rounded-xl bg-orange-500/12 px-4 py-2.5 text-sm font-medium text-orange-300 hover:bg-orange-500/18">
            <RefreshCw className="w-4 h-4" /> Change plan
          </Link>
          <Link href="/browse/account/renew" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05]">
            Renew / Pay
          </Link>
        </div>
      </div>
      {subscription.payments.length > 0 && (
        <div className="storytime-section p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Recent payments</h2>
          <ul className="space-y-2">
            {subscription.payments.map((p, i) => (
              <li key={i} className="flex justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="text-slate-300">R{p.amount.toFixed(2)}</span>
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
