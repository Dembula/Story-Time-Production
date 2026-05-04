"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function PaymentsReturnContent() {
  const params = useSearchParams();
  const status = (params.get("payment_status") || "").toLowerCase();
  const next = params.get("next") || "/profiles";
  const flow = params.get("flow") || "payment";
  const reference = params.get("reference") || "";
  const paymentRecordId = params.get("pr") || "";
  const [resolvedStatus, setResolvedStatus] = useState(status);

  useEffect(() => {
    if (!paymentRecordId) return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      while (!cancelled && Date.now() - startedAt < 120000) {
        try {
          const res = await fetch(`/api/payments/status?paymentRecordId=${encodeURIComponent(paymentRecordId)}`, {
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          const dbStatus = String(data?.payment?.status || "").toUpperCase();
          if (dbStatus === "SUCCEEDED") {
            if (!cancelled) setResolvedStatus("success");
            return;
          }
          if (dbStatus === "FAILED" || dbStatus === "CANCELLED") {
            if (!cancelled) setResolvedStatus("failed");
            return;
          }
        } catch {
          // keep polling until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentRecordId]);

  useEffect(() => {
    if (resolvedStatus !== "success") return;
    const timeout = window.setTimeout(() => {
      window.location.assign(next);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [resolvedStatus, next]);

  const heading = useMemo(() => {
    if (resolvedStatus === "success") return "Payment completed";
    if (resolvedStatus === "failed") return "Payment failed";
    return "Payment status pending";
  }, [resolvedStatus]);

  const message = useMemo(() => {
    if (resolvedStatus === "success") return "Your transaction is confirmed. Redirecting now...";
    if (resolvedStatus === "failed") return "The payment could not be completed. You can retry from the previous screen.";
    return "Waiting for secure confirmation from the payment network...";
  }, [resolvedStatus]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl">
        <p className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-200">
          Payment gateway
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{heading}</h1>
        <p className="mt-2 text-sm text-slate-400">{message}</p>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          <p>Flow: {flow}</p>
          {reference ? <p className="mt-1 break-all">Reference: {reference}</p> : null}
        </div>

        <div className="mt-6 grid gap-3">
          <Link
            href={next}
            className="rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-400"
          >
            Continue
          </Link>
          <Link
            href="/profiles"
            className="rounded-xl border border-slate-700 px-4 py-3 text-center text-sm text-slate-300 hover:bg-slate-800"
          >
            Back to profiles
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentsReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
          <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl">
            <p className="text-sm text-slate-400">Loading payment status…</p>
          </div>
        </main>
      }
    >
      <PaymentsReturnContent />
    </Suspense>
  );
}
