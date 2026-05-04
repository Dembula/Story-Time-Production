/**
 * Normalizes Stitch (and Svix-wrapped Stitch) webhook JSON so we can correlate
 * payments to gatewayReference rows by merchantReference.
 */

const REF_KEYS = new Set([
  "merchantReference",
  "reference",
  "externalRef",
  "merchant_ref",
  "merchant_reference",
]);

export function collectPossibleMerchantReferences(payload: unknown): string[] {
  const out = new Set<string>();
  const visit = (obj: unknown, depth: number) => {
    if (depth > 8 || obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) visit(item, depth + 1);
      return;
    }
    if (typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (REF_KEYS.has(k) && typeof v === "string" && v.trim()) {
        out.add(v.trim());
      }
      visit(v, depth + 1);
    }
  };
  visit(payload, 0);
  return [...out];
}

export function isLikelyPaymentSuccessEvent(payload: Record<string, unknown>): boolean {
  const t = String(payload.type || payload.eventType || "").toLowerCase();
  if (
    t === "payment.succeeded" ||
    t === "payment.completed" ||
    t === "payin.succeeded" ||
    t.includes("payment_link.paid") ||
    t.includes("paymentlink.paid") ||
    (t.includes("payment") && (t.includes("success") || t.includes("paid") || t.includes("complete")))
  ) {
    return true;
  }
  const data = payload.data as Record<string, unknown> | undefined;
  if (data) {
    const status = String(data.status || data.paymentStatus || "").toUpperCase();
    if (status === "PAID" || status === "SUCCEEDED" || status === "SUCCESS") return true;
    const innerType = String(data.type || "").toLowerCase();
    if (innerType.includes("paid") || innerType.includes("success")) return true;
  }
  return false;
}
