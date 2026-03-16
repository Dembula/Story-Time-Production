"use client";

import Link from "next/link";
import { useState } from "react";

export function SubscriptionExpiredModal({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-2">Your subscription has ended</h2>
        <p className="text-slate-400 text-sm mb-6">
          Renew to keep watching. You can still browse the catalogue.
        </p>
        <div className="flex gap-3">
          <Link
            href="/browse/account/renew"
            className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium text-center hover:bg-orange-600 transition"
          >
            Renew subscription
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="py-3 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-700/50 transition"
          >
            Keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}
