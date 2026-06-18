import { createHash } from "crypto";

/** PayFast parameter encoding for signature generation. */
function encodePayFastValue(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

/** Build MD5 signature for PayFast request/ITN payloads. */
export function generatePayFastSignature(
  data: Record<string, string>,
  passphrase?: string | null,
): string {
  const pairs: string[] = [];
  for (const key of Object.keys(data).sort()) {
    if (key === "signature") continue;
    const value = data[key];
    if (value === "" || value == null) continue;
    pairs.push(`${key}=${encodePayFastValue(String(value))}`);
  }
  let payload = pairs.join("&");
  if (passphrase?.trim()) {
    payload += `&passphrase=${encodePayFastValue(passphrase)}`;
  }
  return createHash("md5").update(payload).digest("hex");
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
