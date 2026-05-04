const APP_BASE_URL = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";

export function buildPaymentReturnUrl(nextPath: string, flow: string) {
  const url = new URL("/payments/return", APP_BASE_URL);
  url.searchParams.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
  url.searchParams.set("flow", flow);
  return url.toString();
}

/** Stitch redirect must include ?pr= so /payments/return can poll payment status. */
export function appendPaymentRecordToReturnUrl(
  returnUrl: string | undefined | null,
  paymentRecordId: string,
): string {
  const fallback =
    process.env.STITCH_REDIRECT_URL?.trim() || `${APP_BASE_URL.replace(/\/$/, "")}/payments/return`;
  const base = (returnUrl?.trim() || fallback).trim();
  try {
    const url = new URL(base);
    url.searchParams.set("pr", paymentRecordId);
    return url.toString();
  } catch {
    return base;
  }
}

