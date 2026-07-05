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

/** Append card_saved=1 when redirecting back after PayFast card save/update. */
export function appendCardSavedFlag(nextPath: string): string {
  const path = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  const qIndex = path.indexOf("?");
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex + 1) : "";
  const params = new URLSearchParams(search);
  params.set("card_saved", "1");
  const query = params.toString();
  return query ? `${pathname}?${query}` : `${pathname}?card_saved=1`;
}
