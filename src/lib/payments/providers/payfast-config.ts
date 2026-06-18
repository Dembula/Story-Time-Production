import { PAYMENT_PROVIDER } from "@/lib/payments/config";

export const PAYFAST_PROCESS_URL = "https://www.payfast.co.za/eng/process";
export const PAYFAST_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";
export const PAYFAST_RECURRING_UPDATE_BASE = "https://www.payfast.co.za/eng/recurring/update";
export const PAYFAST_API_BASE = "https://api.payfast.co.za";

/** Canonical production origin for PayFast notify/return URLs. */
export const PAYFAST_PRODUCTION_ORIGIN = "https://story-time.online";

export function getPayFastMerchantId(): string {
  const id = process.env.PAYFAST_MERCHANT_ID?.trim();
  if (!id) throw new Error("PAYFAST_MERCHANT_ID is not configured.");
  return id;
}

export function getPayFastMerchantKey(): string {
  const key = process.env.PAYFAST_MERCHANT_KEY?.trim();
  if (!key) throw new Error("PAYFAST_MERCHANT_KEY is not configured.");
  return key;
}

export function getPayFastPassphraseOrNull(): string | null {
  const phrase = process.env.PAYFAST_PASSPHRASE?.trim();
  return phrase || null;
}

export function getPayFastPassphrase(): string {
  const phrase = getPayFastPassphraseOrNull();
  if (!phrase) throw new Error("PAYFAST_PASSPHRASE is not configured.");
  return phrase;
}

export function isPayFastPassphraseConfigured(): boolean {
  return Boolean(process.env.PAYFAST_PASSPHRASE?.trim());
}

function normalizeOrigin(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).origin;
    }
    return new URL(`https://${value.replace(/\/$/, "")}`).origin;
  } catch {
    return value.replace(/\/$/, "") || null;
  }
}

function isEphemeralPaymentHost(origin: string): boolean {
  const lower = origin.toLowerCase();
  return (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("vercel.app") ||
    lower.includes(".preview.")
  );
}

/**
 * Public origin used for PayFast notify_url, return_url, and checkout page links.
 * Prefers PAYFAST_NOTIFY_URL / NEXT_PUBLIC_BASE_URL over ephemeral Vercel preview hosts.
 */
export function getPaymentBaseUrl(): string {
  const notifyOverride = process.env.PAYFAST_NOTIFY_URL?.trim();
  if (notifyOverride) {
    const fromNotify = normalizeOrigin(notifyOverride);
    if (fromNotify) return fromNotify;
  }

  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin && !isEphemeralPaymentHost(origin)) return origin;
  }

  if (process.env.NODE_ENV === "production") {
    return PAYFAST_PRODUCTION_ORIGIN;
  }

  const fallback = normalizeOrigin(process.env.NEXTAUTH_URL) || "http://localhost:3000";
  return fallback;
}

/** @deprecated Prefer getPaymentBaseUrl() for payment URLs. */
export function appBaseUrl(): string {
  return getPaymentBaseUrl();
}

export function payfastNotifyUrl(): string {
  const override = process.env.PAYFAST_NOTIFY_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${getPaymentBaseUrl()}/api/payments/webhooks/payfast`;
}

export function payfastCheckoutPageUrl(paymentRecordId: string): string {
  return `${getPaymentBaseUrl()}/payments/payfast-checkout?pr=${encodeURIComponent(paymentRecordId)}`;
}

/** PayFast hosted page to update card details for an existing subscription/token. */
export function buildPayFastCardUpdateUrl(token: string, returnUrl: string): string {
  const trimmedToken = token.trim();
  const url = new URL(`${PAYFAST_RECURRING_UPDATE_BASE}/${encodeURIComponent(trimmedToken)}`);
  url.searchParams.set("return", returnUrl);
  return url.toString();
}

export { PAYMENT_PROVIDER };
