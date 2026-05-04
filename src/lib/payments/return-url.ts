const APP_BASE_URL = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
const STITCH_REDIRECT_URL = process.env.STITCH_REDIRECT_URL?.trim() || "";

function resolvePaymentBaseUrl() {
  // Prefer Stitch's registered redirect URL host/path so checkout redirects
  // remain valid even on preview domains.
  if (STITCH_REDIRECT_URL) return STITCH_REDIRECT_URL;
  return new URL("/payments/return", APP_BASE_URL).toString();
}

export function buildPaymentReturnUrl(nextPath: string, flow: string) {
  const url = new URL(resolvePaymentBaseUrl());
  url.searchParams.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
  url.searchParams.set("flow", flow);
  return url.toString();
}

/** Stitch redirect must include ?pr= so /payments/return can poll payment status. */
export function appendPaymentRecordToReturnUrl(
  returnUrl: string | undefined | null,
  paymentRecordId: string,
): string {
  const fallback = resolvePaymentBaseUrl();
  const base = (returnUrl?.trim() || fallback).trim();
  try {
    const url = new URL(base);
    url.searchParams.set("pr", paymentRecordId);
    return url.toString();
  } catch {
    return base;
  }
}

