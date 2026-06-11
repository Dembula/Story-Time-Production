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
      subtitle="Pay securely with PayFast to unlock messaging and confirm your booking with the company."
    />
  );
}
