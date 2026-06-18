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

/** PHP `urlencode()` with PayFast uppercase percent-encoding (RFC 1738 / FAQ). */
export function encodePayFastPhpUrlencode(value: string, trim = true): string {
  const source = trim ? value.trim() : value;
  let encoded = encodeURIComponent(source).replace(/%20/g, "+");
  encoded = encoded
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
  return encoded.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => `%${hex.toUpperCase()}`);
}

/** @deprecated Use encodePayFastPhpUrlencode */
export function encodePayFastValue(value: string): string {
  return encodePayFastPhpUrlencode(value, true);
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

/** Checkout signature — PHP `generateSignature()` (field order, skip empty, trim values). */
export function buildPayFastCheckoutParamString(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  const cleaned = omitEmptyPayFastFields(data);
  const keys = orderedPayFastKeys(cleaned, PAYFAST_CHECKOUT_FIELD_ORDER);
  const pairs: string[] = [];
  for (const key of keys) {
    const value = cleaned[key];
    if (value == null || value === "") continue;
    pairs.push(`${key}=${encodePayFastPhpUrlencode(String(value), true)}`);
  }
  let payload = pairs.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastPhpUrlencode(passphrase, true)}`;
  }
  return payload;
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
    pairs.push(`${key}=${encodePayFastPhpUrlencode(String(value), true)}`);
  }

  let payload = pairs.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastPhpUrlencode(passphrase, true)}`;
  }
  return payload;
}

export type PayFastFormPair = { key: string; value: string };

/** Preserve POST field order from an ITN body (required for PayFast signature checks). */
export function parsePayFastFormBodyOrdered(raw: string): PayFastFormPair[] {
  const pairs: PayFastFormPair[] = [];
  const trimmed = raw.trim();
  if (!trimmed) return pairs;

  for (const segment of trimmed.split("&")) {
    if (!segment) continue;
    const eq = segment.indexOf("=");
    const rawKey = eq >= 0 ? segment.slice(0, eq) : segment;
    const rawVal = eq >= 0 ? segment.slice(eq + 1) : "";
    try {
      pairs.push({
        key: decodeURIComponent(rawKey.replace(/\+/g, " ")),
        value: decodeURIComponent(rawVal.replace(/\+/g, " ")),
      });
    } catch {
      pairs.push({ key: rawKey, value: rawVal });
    }
  }
  return pairs;
}

/**
 * ITN param string — PHP sample loops POST fields in order until `signature`.
 * Values are urlencoded without trimming; empty values are included.
 */
export function buildPayFastItnParamString(
  pairs: PayFastFormPair[],
  passphrase?: string | null,
): string {
  const parts: string[] = [];
  for (const { key, value } of pairs) {
    if (key === "signature") break;
    parts.push(`${key}=${encodePayFastPhpUrlencode(value, false)}`);
  }
  let payload = parts.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastPhpUrlencode(passphrase, true)}`;
  }
  return payload;
}

/** Payload for PayFast `/eng/query/validate` — POST order, no signature, no passphrase. */
export function buildPayFastItnValidatePayload(rawBody: string): string {
  const parts: string[] = [];
  for (const { key, value } of parsePayFastFormBodyOrdered(rawBody)) {
    if (key === "signature") break;
    parts.push(`${key}=${encodePayFastPhpUrlencode(value, false)}`);
  }
  return parts.join("&");
}

function md5PayFastPayload(payload: string): string {
  return createHash("md5").update(payload).digest("hex");
}

/** Signature for redirect checkout / card-consent forms. */
export function generatePayFastCheckoutSignature(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  return md5PayFastPayload(buildPayFastCheckoutParamString(data, passphrase));
}

/** Signature for REST API header auth (alphabetical). */
export function generatePayFastSignature(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  const payload = buildPayFastSignaturePayload(data, passphrase, "alphabetical");
  return md5PayFastPayload(payload);
}

export function verifyPayFastItnSignatureFromRawBody(
  rawBody: string,
  signature: string | null | undefined,
  passphrase?: string | null,
): boolean {
  if (!signature?.trim()) return false;
  const pairs = parsePayFastFormBodyOrdered(rawBody);
  const envPass = (passphrase ?? process.env.PAYFAST_PASSPHRASE?.trim()) || null;

  const matches = (pass: string | null) => {
    const expected = md5PayFastPayload(buildPayFastItnParamString(pairs, pass));
    return expected.toLowerCase() === signature.trim().toLowerCase();
  };

  if (matches(envPass)) return true;
  if (envPass && matches(null)) return true;
  return false;
}

export function verifyPayFastItnSignature(
  data: Record<string, string>,
  signature: string | null | undefined,
  rawBody?: string,
): boolean {
  if (rawBody?.trim()) {
    if (verifyPayFastItnSignatureFromRawBody(rawBody, signature)) return true;
  }

  const passphrase = process.env.PAYFAST_PASSPHRASE?.trim() || null;
  const pairs = Object.entries(data).map(([key, value]) => ({ key, value }));
  const matchesOrdered = (pass: string | null) => {
    const expected = md5PayFastPayload(buildPayFastItnParamString(pairs, pass));
    return signature?.trim() && expected.toLowerCase() === signature.trim().toLowerCase();
  };
  if (matchesOrdered(passphrase)) return true;
  if (passphrase && matchesOrdered(null)) return true;

  if (verifyPayFastSignature(data, signature, passphrase)) return true;
  if (passphrase && verifyPayFastSignature(data, signature, null)) return true;
  return false;
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
  const out: Record<string, string> = {};
  for (const { key, value } of parsePayFastFormBodyOrdered(raw)) {
    out[key] = value;
  }
  return out;
}
