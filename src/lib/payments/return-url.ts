import { getPaymentBaseUrl } from "@/lib/payments/providers/payfast-config";

function resolvePaymentBaseUrl() {
  return new URL("/payments/return", getPaymentBaseUrl()).toString();
}

export function buildPaymentReturnUrl(nextPath: string, flow: string) {
  const url = new URL(resolvePaymentBaseUrl());
  url.searchParams.set("next", nextPath.startsWith("/") ? nextPath : `/${nextPath}`);
  url.searchParams.set("flow", flow);
  return url.toString();
}

/** Return URL must include ?pr= so /payments/return can poll payment status. */
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
