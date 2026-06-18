import { PAYMENT_PROVIDER } from "@/lib/payments/config";

export const PAYFAST_PROCESS_URL = "https://www.payfast.co.za/eng/process";
export const PAYFAST_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";
export const PAYFAST_API_BASE = "https://api.payfast.co.za";

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

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

export function payfastNotifyUrl(): string {
  const override = process.env.PAYFAST_NOTIFY_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${appBaseUrl()}/api/payments/webhooks/payfast`;
}

export function payfastCheckoutPageUrl(paymentRecordId: string): string {
  return `${appBaseUrl()}/payments/payfast-checkout?pr=${encodeURIComponent(paymentRecordId)}`;
}

export { PAYMENT_PROVIDER };
