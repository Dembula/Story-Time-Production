import { createHmac, timingSafeEqual } from "crypto";

const MAX_WEBHOOK_AGE_SEC = 600;

/** Parse `Webhook-Signature: time=...,sig1=...` from Cloudflare Stream. */
export function verifyCloudflareStreamWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) return false;

  const fields: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  const time = fields.time;
  const sig1 = fields.sig1;
  if (!time || !sig1) return false;

  const ts = Number(time);
  if (!Number.isFinite(ts)) return false;
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (ageSec > MAX_WEBHOOK_AGE_SEC) return false;

  const source = `${time}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(source).digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isLegacyWebhookSecretHeaderMatch(
  req: { headers: { get: (name: string) => string | null } },
  secret: string,
): boolean {
  const provided =
    req.headers.get("x-stream-webhook-secret") ??
    req.headers.get("webhook-secret") ??
    req.headers.get("x-webhook-secret");
  return Boolean(provided?.trim() && provided.trim() === secret.trim());
}
