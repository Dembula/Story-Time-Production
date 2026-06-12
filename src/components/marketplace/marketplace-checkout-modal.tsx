"use client";

import { CheckoutModal } from "@/components/payments/checkout-modal";

export function MarketplaceCheckoutModal({
  open,
  checkoutUrl,
  onClose,
  title = "Marketplace checkout",
}: {
  open: boolean;
  checkoutUrl: string;
  onClose: () => void;
  title?: string;
}) {
  return (
    <CheckoutModal
      open={open}
      checkoutUrl={checkoutUrl}
      onClose={onClose}
      title={title}
      subtitle={
        checkoutUrl.includes("/payments/demo-checkout")
          ? "Demo checkout — confirm your booking with a simulated payment (no real charge)."
          : "Pay securely with PayFast to unlock messaging and confirm your booking with the company."
      }
    />
  );
}
