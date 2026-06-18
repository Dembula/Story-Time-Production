"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

function PayFastCheckoutInner() {
  const params = useSearchParams();
  const pr = params.get("pr") ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [action, setAction] = useState("");

  useEffect(() => {
    if (!pr) {
      setError("Missing payment reference.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payments/payfast/session?pr=${encodeURIComponent(pr)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Unable to start PayFast checkout.");
        if (!cancelled) {
          setAction(String(data.action ?? ""));
          setFields(data.fields ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Checkout failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pr]);

  useEffect(() => {
    if (!fields || !action || !formRef.current) return;
    formRef.current.submit();
  }, [fields, action]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" /> PayFast secure checkout
      </div>
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      <p className="text-sm text-slate-400">Redirecting to PayFast…</p>
      {fields && action ? (
        <form ref={formRef} method="POST" action={action} className="hidden">
          {Object.entries(fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      ) : null}
    </div>
  );
}

export default function PayFastCheckoutPage() {
  return (
    <Suspense fallback={<StoryTimeLoadingCenter />}>
      <PayFastCheckoutInner />
    </Suspense>
  );
}
