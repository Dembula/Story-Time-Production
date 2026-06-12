"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";

function formatAmount(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency || "ZAR",
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `R ${n.toFixed(2)}`;
  }
}

function DemoCheckoutContent() {
  const params = useSearchParams();
  const redirectUrl = params.get("redirectUrl") || "/";
  const reference = params.get("reference") || "";
  const paymentRecordId = params.get("pr") || "";
  const amount = params.get("amount") || "";
  const currency = params.get("currency") || "ZAR";
  const purpose = params.get("purpose") || "Platform payment";
  const flow = params.get("flow") || "checkout";

  const [busy, setBusy] = useState<"pay" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const formattedAmount = useMemo(() => formatAmount(amount, currency), [amount, currency]);
  const isCardConsent = flow === "card_consent";

  const finishRedirect = (status: "success" | "failed") => {
    try {
      const url = new URL(redirectUrl, window.location.origin);
      url.searchParams.set("payment_status", status);
      if (reference) url.searchParams.set("reference", reference);
      if (paymentRecordId) url.searchParams.set("pr", paymentRecordId);
      window.location.assign(url.toString());
    } catch {
      const sep = redirectUrl.includes("?") ? "&" : "?";
      window.location.assign(
        `${redirectUrl}${sep}payment_status=${status}${reference ? `&reference=${encodeURIComponent(reference)}` : ""}${paymentRecordId ? `&pr=${encodeURIComponent(paymentRecordId)}` : ""}`,
      );
    }
  };

  const handlePay = async () => {
    setBusy("pay");
    setError(null);
    try {
      const res = await fetch("/api/payments/demo/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentRecordId: paymentRecordId || undefined,
          reference,
          flow,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not complete demo payment.");
      }
      setDone(true);
      window.setTimeout(() => finishRedirect("success"), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setBusy(null);
    }
  };

  const handleFail = async () => {
    setBusy("fail");
    setError(null);
    try {
      if (paymentRecordId && !isCardConsent) {
        await fetch("/api/payments/demo/fail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentRecordId }),
        });
      }
      finishRedirect("failed");
    } catch {
      finishRedirect("failed");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            Demo mode — no real charge
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl">
          <div className="border-b border-white/10 bg-gradient-to-r from-orange-500/15 to-transparent px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Story Time Checkout</h1>
                <p className="text-xs text-slate-400">Payment gateway coming soon</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {isCardConsent ? "Save payment method" : "You are paying for"}
              </p>
              <p className="mt-1 text-sm text-slate-200">{purpose}</p>
              {formattedAmount && !isCardConsent ? (
                <p className="mt-3 text-3xl font-bold text-white">{formattedAmount}</p>
              ) : null}
              {isCardConsent ? (
                <p className="mt-2 text-sm text-slate-400">
                  In demo mode we simulate saving a card for renewals after your trial. No card details are collected.
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-100/90">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p>
                PayFast integration is not live yet. This demo completes your purchase instantly so you can keep
                building and testing on the platform.
              </p>
            </div>

            {reference ? (
              <p className="break-all font-mono text-[10px] text-slate-600">Ref: {reference}</p>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {done ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-emerald-200">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Payment confirmed — redirecting…</span>
              </div>
            ) : (
              <div className="grid gap-3 pt-1">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handlePay()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-orange-500 disabled:opacity-60"
                >
                  {busy === "pay" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : isCardConsent ? (
                    "Save card & continue (demo)"
                  ) : (
                    "Pay now (demo)"
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void handleFail()}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                >
                  Cancel payment
                </button>
                <Link
                  href={redirectUrl}
                  className="text-center text-xs text-slate-500 hover:text-slate-300"
                >
                  Return without paying
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DemoCheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </main>
      }
    >
      <DemoCheckoutContent />
    </Suspense>
  );
}
