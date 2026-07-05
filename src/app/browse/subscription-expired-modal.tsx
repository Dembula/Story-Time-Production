"use client";

import { SubscriptionResumeButton } from "@/components/viewer/subscription-resume-checkout";

export function SubscriptionExpiredModal({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-2">Your subscription has ended</h2>
        <p className="text-slate-400 text-sm mb-6">
          Complete payment to restore access to the catalogue. You cannot browse until your subscription is active again.
        </p>
        <SubscriptionResumeButton label="Pay & resume subscription" className="w-full py-3 rounded-xl viewer-btn-primary font-medium transition disabled:opacity-60" />
      </div>
    </div>
  );
}
