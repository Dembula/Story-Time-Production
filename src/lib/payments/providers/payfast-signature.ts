import { createHash } from "crypto";

/** PayFast checkout form fields must be signed in documentation order, not alphabetically. */
export const PAYFAST_CHECKOUT_FIELD_ORDER = [
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  "email_confirmation",
  "confirmation_address",
  "payment_method",
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
  "subscription_notify_email",
  "subscription_notify_webhook",
  "subscription_notify_buyer",
] as const;

/** RFC 1738-style encoding (PHP urlencode): spaces as +, not %20. */
export function encodePayFastValue(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

export function omitEmptyPayFastFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === "signature") continue;
    const trimmed = String(value ?? "").trim();
    if (trimmed !== "") out[key] = trimmed;
  }
  return out;
}

function orderedPayFastKeys(
  data: Record<string, string>,
  fieldOrder: readonly string[],
): string[] {
  const keys = new Set(Object.keys(data).filter((k) => k !== "signature"));
  const ordered: string[] = [];
  for (const key of fieldOrder) {
    if (keys.has(key)) ordered.push(key);
  }
  for (const key of keys) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

function buildPayFastSignaturePayload(
  data: Record<string, string>,
  passphrase: string | null | undefined,
  fieldOrder: readonly string[] | "alphabetical",
): string {
  const cleaned = omitEmptyPayFastFields(data);
  const keys =
    fieldOrder === "alphabetical"
      ? Object.keys(cleaned).sort()
      : orderedPayFastKeys(cleaned, fieldOrder);

  const pairs: string[] = [];
  for (const key of keys) {
    const value = cleaned[key];
    if (value == null || value === "") continue;
    pairs.push(`${key}=${encodePayFastValue(String(value))}`);
  }

  let payload = pairs.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastValue(passphrase)}`;
  }
  return payload;
}

/** Signature for redirect checkout / card-consent forms. */
export function generatePayFastCheckoutSignature(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  const payload = buildPayFastSignaturePayload(data, passphrase, PAYFAST_CHECKOUT_FIELD_ORDER);
  return createHash("md5").update(payload).digest("hex");
}

/** Signature for ITN webhooks and REST API header auth (alphabetical). */
export function generatePayFastSignature(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  const payload = buildPayFastSignaturePayload(data, passphrase, "alphabetical");
  return createHash("md5").update(payload).digest("hex");
}

export function verifyPayFastItnSignature(
  data: Record<string, string>,
  signature: string | null | undefined,
): boolean {
  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim() || null;
  if (verifyPayFastSignature(data, signature, passphrase)) return true;
  if (passphrase && verifyPayFastSignature(data, signature, null)) return true;
  if (verifyPayFastItnSignaturePostOrder(data, signature, passphrase)) return true;
  if (passphrase && verifyPayFastItnSignaturePostOrder(data, signature, null)) return true;
  return false;
}

/** PayFast PHP ITN samples verify fields in POST order (excluding signature). */
function verifyPayFastItnSignaturePostOrder(
  data: Record<string, string>,
  signature: string | null | undefined,
  passphrase?: string | null,
): boolean {
  if (!signature?.trim()) return false;

  const pairs: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "signature") break;
    const trimmed = String(value ?? "").trim();
    if (trimmed === "") continue;
    pairs.push(`${key}=${encodePayFastValue(trimmed)}`);
  }

  let payload = pairs.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastValue(passphrase)}`;
  }

  const expected = createHash("md5").update(payload).digest("hex");
  return expected.toLowerCase() === signature.trim().toLowerCase();
}

export function verifyPayFastSignature(
  data: Record<string, string>,
  signature: string | null | undefined,
  passphrase?: string | null,
): boolean {
  if (!signature?.trim()) return false;
  const expected = generatePayFastSignature(data, passphrase);
  return expected.toLowerCase() === signature.trim().toLowerCase();
}

/** Parse application/x-www-form-urlencoded body into a flat string map. */
export function parsePayFastFormBody(raw: string): Record<string, string> {
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}
