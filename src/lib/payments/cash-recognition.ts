import "server-only";

import { DEMO_PAYMENT_PROVIDER } from "@/lib/payments/config";
import { getPaymentSettlementAmount } from "@/lib/payments/payfast-settlement";

type PaymentLike = {
  amount?: number | null;
  settlementAmount?: number | null;
  providerFeeAmount?: number | null;
  status?: string | null;
  purpose?: string | null;
  provider?: string | null;
  metadata?: unknown;
  settlementSource?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** True when this row is a demo/sandbox completion — not real PayFast cash. */
export function isDemoPaymentRecord(payment: PaymentLike): boolean {
  const provider = String(payment.provider ?? "").toUpperCase();
  if (provider === DEMO_PAYMENT_PROVIDER || provider === "DEMO") return true;
  const source = String(payment.settlementSource ?? "").toLowerCase();
  if (source === "demo") return true;
  const meta = asRecord(payment.metadata);
  if (!meta) return false;
  // demoCompletedAt was historically stamped on live PayFast ITNs — only trust it with demo provider/source.
  if (meta.gateway === "demo" || meta.provider === "demo") return true;
  const ref = String(meta.gatewayReference ?? "");
  if (ref.startsWith("demo-") || ref.startsWith("pf-demo")) return true;
  return false;
}

/** True when checkout was fully covered by a promo (no cash collected). */
export function isPromoCoveredPaymentRecord(payment: PaymentLike): boolean {
  const amount = Number(payment.amount ?? 0);
  if (!(amount > 0)) return true;
  const meta = asRecord(payment.metadata);
  if (!meta) return false;
  if (meta.promoFreeGrant === true || meta.fundingSource === "promo") return true;
  if (meta.promoKind === "FREE_YEAR_SUBSCRIPTION") return true;
  const discountedTo = meta.finalPriceAfterPromo;
  if (typeof discountedTo === "number" && discountedTo <= 0) return true;
  return false;
}

/**
 * Cash that should count toward admin revenue / pools / ledger.
 * Excludes: non-succeeded, zero amounts, promo-covered, demo, and non-PayFast legacy rows.
 */
export function isCashRecognizedPayment(payment: PaymentLike): boolean {
  if (String(payment.status ?? "").toUpperCase() !== "SUCCEEDED") return false;
  if (isDemoPaymentRecord(payment)) return false;
  if (isPromoCoveredPaymentRecord(payment)) return false;
  const amount = Number(payment.amount ?? 0);
  if (!(amount > 0)) return false;

  const provider = String(payment.provider ?? "").toUpperCase();
  const settlementSource = String(payment.settlementSource ?? "").toLowerCase();
  // Live PayFast (ITN or estimated settlement) only — STITCH/DEMO/legacy do not count as cash.
  if (provider === "PAYFAST") return true;
  if (settlementSource === "itn" || settlementSource === "estimated") return true;
  return false;
}

/** Net ZAR for pool/treasury math (0 when not cash-recognized). */
export function getCashSettlementAmount(payment: PaymentLike): number {
  if (!isCashRecognizedPayment(payment)) return 0;
  return getPaymentSettlementAmount({
    amount: Number(payment.amount ?? 0),
    settlementAmount:
      payment.settlementAmount != null && Number.isFinite(Number(payment.settlementAmount))
        ? Number(payment.settlementAmount)
        : null,
  });
}

export function paymentFundingSource(payment: PaymentLike): "cash" | "promo" | "demo" | "other" {
  if (isDemoPaymentRecord(payment)) return "demo";
  if (isPromoCoveredPaymentRecord(payment)) return "promo";
  if (isCashRecognizedPayment(payment)) return "cash";
  return "other";
}
