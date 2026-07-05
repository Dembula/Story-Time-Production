"use client";

import { CheckoutModal } from "@/components/payments/checkout-modal";

export function MarketplaceCheckoutModal({
  open,
  checkoutUrl,
  onClose,
  title = "Marketplace checkout",
  subtitle,
}: {
  open: boolean;
  checkoutUrl: string;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  const defaultSubtitle = checkoutUrl.includes("/payments/demo-checkout")
    ? "Demo checkout — confirm your booking with a simulated payment (no real charge)."
    : "Pay securely with PayFast to confirm your booking with the company.";

  return (
    <CheckoutModal
      open={open}
      checkoutUrl={checkoutUrl}
      onClose={onClose}
      title={title}
      subtitle={subtitle ?? defaultSubtitle}
    />
  );
}
