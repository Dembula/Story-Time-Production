"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { CheckoutModal } from "@/components/payments/checkout-modal";

type SubscriptionResumeCheckoutProps = {
  children: (props: { onClick: () => void; loading: boolean }) => ReactNode;
  onError?: (message: string) => void;
  className?: string;
};

/** Starts PayFast checkout for the viewer's current plan (reactivation / past due / lapsed). */
export function SubscriptionResumeCheckout({
  children,
  onError,
}: SubscriptionResumeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/viewer/subscription/resume-checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Could not start payment");
      }
      const url = (data as { checkoutUrl?: string }).checkoutUrl;
      if (!url) throw new Error("Payment gateway did not return a checkout link");
      setCheckoutUrl(url);
      setCheckoutOpen(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  return (
    <>
      {children({ onClick: () => void startCheckout(), loading })}
      <CheckoutModal
        open={checkoutOpen}
        checkoutUrl={checkoutUrl}
        dismissible={false}
        title="Complete subscription payment"
        subtitle="Pay securely to restore your Story Time access."
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}

type SubscriptionResumeButtonProps = {
  label?: string;
  className?: string;
  onError?: (message: string) => void;
};

export function SubscriptionResumeButton({
  label = "Pay & resume subscription",
  className = "inline-flex rounded-xl viewer-btn-primary px-5 py-2.5 font-semibold transition hover:-translate-y-0.5 disabled:opacity-60",
  onError,
}: SubscriptionResumeButtonProps) {
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <SubscriptionResumeCheckout onError={(msg) => { setError(msg); onError?.(msg); }}>
        {({ onClick, loading }) => (
          <button type="button" onClick={onClick} disabled={loading} className={className}>
            {loading ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            {label}
          </button>
        )}
      </SubscriptionResumeCheckout>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
