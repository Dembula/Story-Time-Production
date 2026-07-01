"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type PayResponse = {
  requiresPayment?: boolean;
  awaitingGatewayConfirmation?: boolean;
  checkoutUrl?: string;
  paymentRecordId?: string;
  transactionId?: string;
  error?: string;
  totalAmount?: number;
};

export function useMarketplacePay(options?: { onPaid?: (transactionId: string) => void }) {
  const searchParams = useSearchParams();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [paying, setPaying] = useState(false);

  const pollPaymentRecord = useCallback(async (paymentRecordId: string) => {
    for (let i = 0; i < 24; i += 1) {
      const res = await fetch(`/api/payments/status?paymentRecordId=${encodeURIComponent(paymentRecordId)}`);
      const data = await res.json().catch(() => null);
      if (data?.payment?.status === "SUCCEEDED") return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }, []);

  useEffect(() => {
    const paymentRecordId = searchParams.get("paymentRecordId");
    if (!paymentRecordId) return;
    let cancelled = false;
    (async () => {
      const ok = await pollPaymentRecord(paymentRecordId);
      if (!cancelled && ok) {
        options?.onPaid?.(paymentRecordId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, pollPaymentRecord, options]);

  const pay = useCallback(
    async (payUrl: string) => {
      setPaying(true);
      try {
        const res = await fetch(payUrl, { method: "POST" });
        const data = (await res.json().catch(() => null)) as PayResponse | null;
        if (!res.ok) {
          throw new Error(data?.error || "Payment failed");
        }
        if (data?.requiresPayment && data.awaitingGatewayConfirmation && data.paymentRecordId) {
          const ok = await pollPaymentRecord(data.paymentRecordId);
          if (ok) {
            options?.onPaid?.(data.paymentRecordId);
            return { mode: "saved_card" as const, data };
          }
          throw new Error("Payment is still processing. Check back shortly or try hosted checkout.");
        }
        if (data?.requiresPayment && data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          setCheckoutOpen(true);
          return { mode: "checkout" as const, data };
        }
        if (data?.transactionId) {
          options?.onPaid?.(data.transactionId);
          return { mode: "wallet" as const, data };
        }
        throw new Error("Unexpected payment response");
      } finally {
        setPaying(false);
      }
    },
    [options, pollPaymentRecord],
  );

  return {
    pay,
    paying,
    checkoutOpen,
    checkoutUrl,
    closeCheckout: () => setCheckoutOpen(false),
  };
}
