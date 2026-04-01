"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, RefreshCw } from "lucide-react";

export default function RenewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRetry() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/subscription/renew", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Renewal failed");
      }
      router.push("/browse/account");
      router.refresh();
    } catch (renewError) {
      setError(renewError instanceof Error ? renewError.message : "Renewal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="storytime-section p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-200">
            <RefreshCw className="h-3.5 w-3.5" />
            Viewer renewal
          </div>
          <h1 className="text-3xl font-semibold text-white">Resume your subscription</h1>
          <p className="mt-3 text-slate-400">
            Retry your saved card if Story Time already has one on file, or return to plan selection to add a new payment method.
          </p>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-glow hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Retry saved-card renewal
            </button>
            <Link
              href="/onboarding/package"
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 font-medium text-slate-300 hover:bg-white/[0.05]"
            >
              Choose a new plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
