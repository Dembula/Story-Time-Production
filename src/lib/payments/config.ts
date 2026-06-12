export const PAYMENT_CURRENCY = "ZAR";
export const PLATFORM_TX_FEE_RATE = 0.035;
export const VIEWER_CREATOR_SPLIT = 0.6;
export const VIEWER_PLATFORM_SPLIT = 0.4;
export const PAYMENT_PROVIDER = "PAYFAST";
export const DEMO_PAYMENT_PROVIDER = "DEMO";

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** True when PayFast merchant credentials are present. */
export function isPayFastConfigured(): boolean {
  return Boolean(
    process.env.PAYFAST_MERCHANT_ID?.trim() &&
      process.env.PAYFAST_MERCHANT_KEY?.trim(),
  );
}

/**
 * Demo checkout runs when no live gateway is configured.
 * Set PAYMENTS_DEMO_MODE=false to disable even without PayFast.
 */
export function isDemoPaymentsMode(): boolean {
  if (isPayFastConfigured()) return false;
  if (process.env.PAYMENTS_DEMO_MODE === "false") return false;
  return true;
}

export type PaymentGatewayMode = "payfast" | "demo" | "unconfigured";

export function getPaymentGatewayMode(): PaymentGatewayMode {
  if (isPayFastConfigured()) return "payfast";
  if (isDemoPaymentsMode()) return "demo";
  return "unconfigured";
}
