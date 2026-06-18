"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const PAYMENT_RECORD_STORAGE_KEY = "st_payment_record_id";

function resolvePaymentRecordId(params: URLSearchParams): string {
  const fromQuery = params.get("pr") || params.get("paymentRecordId") || params.get("m_payment_id") || "";
  if (fromQuery) return fromQuery;
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PAYMENT_RECORD_STORAGE_KEY) || "";
}

function PaymentsReturnContent() {
  const params = useSearchParams();
  const status = (params.get("payment_status") || "").toLowerCase();
  const next = params.get("next") || "/profiles";
  const flow = params.get("flow") || "payment";
  const reference = params.get("reference") || "";
  const paymentRecordId = resolvePaymentRecordId(params);
  const [resolvedStatus, setResolvedStatus] = useState(status);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "success" || !paymentRecordId) return;
    let cancelled = false;
    (async () => {
      try {
        const statusRes = await fetch(`/api/payments/status?paymentRecordId=${encodeURIComponent(paymentRecordId)}`, {
          cache: "no-store",
        });
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData?.gatewayMode !== "demo") return;

        const res = await fetch("/api/payments/demo/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentRecordId }),
        });
        if (!cancelled && res.ok) setResolvedStatus("success");
      } catch {
        // polling below will handle live gateway flows
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, paymentRecordId]);

  useEffect(() => {
    if (!paymentRecordId) return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      while (!cancelled && Date.now() - startedAt < 180000) {
        try {
          const res = await fetch(`/api/payments/status?paymentRecordId=${encodeURIComponent(paymentRecordId)}`, {
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          const dbStatus = String(data?.payment?.status || "").toUpperCase();
          if (dbStatus === "SUCCEEDED") {
            if (!cancelled) {
              sessionStorage.removeItem("st_pending_viewer_checkout");
              sessionStorage.removeItem(PAYMENT_RECORD_STORAGE_KEY);
              setResolvedStatus("success");
            }
            return;
          }
          if (dbStatus === "FAILED" || dbStatus === "CANCELLED") {
            if (!cancelled) setResolvedStatus("failed");
            return;
          }

          // Authenticated fallback when a session cookie is still present.
          const syncRes = await fetch("/api/payments/payfast/confirm-return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentRecordId }),
            cache: "no-store",
          }).catch(() => null);

          if (syncRes?.ok) {
            const syncData = await syncRes.json().catch(() => ({}));
            const syncedStatus = String(syncData?.payment?.status || "").toUpperCase();
            if (syncedStatus === "SUCCEEDED") {
              if (!cancelled) {
                sessionStorage.removeItem("st_pending_viewer_checkout");
                sessionStorage.removeItem(PAYMENT_RECORD_STORAGE_KEY);
                setResolvedStatus("success");
              }
              return;
            }
          }
        } catch {
          // keep polling until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) setTimedOut(true);
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
    if (timedOut) return "Payment confirmation delayed";
    return "Payment status pending";
  }, [resolvedStatus, timedOut]);

  const message = useMemo(() => {
    if (resolvedStatus === "success") return "Your transaction is confirmed. Redirecting now...";
    if (resolvedStatus === "failed") return "The payment could not be completed. You can retry from the previous screen.";
    if (timedOut) {
      return "PayFast may still be sending confirmation. You can continue — we will activate your access as soon as confirmation arrives.";
    }
    return "Waiting for secure confirmation from the payment network...";
  }, [resolvedStatus, timedOut]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl">
        <p className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-200">
          {resolvedStatus === "success" ? "Payment confirmed" : "Payment gateway"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">{heading}</h1>
        <p className="mt-2 text-sm text-slate-400">{message}</p>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          <p>Flow: {flow}</p>
          {reference ? <p className="mt-1 break-all">Reference: {reference}</p> : null}
          {paymentRecordId ? <p className="mt-1 break-all">Payment: {paymentRecordId}</p> : null}
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
