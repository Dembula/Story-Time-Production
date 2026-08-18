"use client";

import Link from "next/link";
import { SubscriptionResumeButton } from "@/components/viewer/subscription-resume-checkout";

export function SubscriptionExpiredModal({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-2">Your subscription has ended</h2>
        <p className="text-slate-400 text-sm mb-6">
          Pay for your current plan to keep watching, or switch to another household size or Pay Per View.
        </p>
        <div className="space-y-3">
          <SubscriptionResumeButton label="Pay & resume subscription" className="w-full py-3 rounded-xl viewer-btn-primary font-medium transition disabled:opacity-60" />
          <Link
            href="/onboarding/package"
            className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.07]"
          >
            Switch plan
          </Link>
        </div>
      </div>
    </div>
  );
}
