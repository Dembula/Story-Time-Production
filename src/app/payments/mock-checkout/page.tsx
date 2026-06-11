"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

function appendResult(redirectUrl: string, status: "success" | "failed", reference: string) {
  try {
    const url = new URL(redirectUrl);
    url.searchParams.set("payment_status", status);
    if (reference) url.searchParams.set("reference", reference);
    return url.toString();
  } catch {
    const separator = redirectUrl.includes("?") ? "&" : "?";
    return `${redirectUrl}${separator}payment_status=${status}${reference ? `&reference=${encodeURIComponent(reference)}` : ""}`;
  }
}

function MockCheckoutContent() {
  const params = useSearchParams();
  const redirectUrl = params.get("redirectUrl") || "/";
  const reference = params.get("reference") || "";
  const provider = (params.get("provider") || "payfast").toUpperCase();

  const successUrl = useMemo(() => appendResult(redirectUrl, "success", reference), [redirectUrl, reference]);
  const failedUrl = useMemo(() => appendResult(redirectUrl, "failed", reference), [redirectUrl, reference]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-400/20 bg-slate-900/70 p-6 shadow-2xl">
        <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-200">
          Encrypted checkout
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Mock {provider} Checkout</h1>
        <p className="mt-2 text-sm text-slate-400">
          This is a development-only fallback checkout for local payment flow testing.
        </p>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
          <p className="text-slate-300">Reference</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-400">{reference || "N/A"}</p>
        </div>

        <div className="mt-6 grid gap-3">
          <a
            href={successUrl}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Simulate successful payment
          </a>
          <a
            href={failedUrl}
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-200 hover:bg-red-500/20"
          >
            Simulate failed payment
          </a>
          <Link
            href={redirectUrl}
            className="rounded-xl border border-slate-700 px-4 py-3 text-center text-sm text-slate-300 hover:bg-slate-800"
          >
            Return without payment
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
          <div className="mx-auto max-w-lg rounded-2xl border border-emerald-400/20 bg-slate-900/70 p-6 shadow-2xl">
            <p className="text-sm text-slate-400">Loading checkout…</p>
          </div>
        </main>
      }
    >
      <MockCheckoutContent />
    </Suspense>
  );
}
