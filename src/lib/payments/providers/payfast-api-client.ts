import "server-only";

import {
  getPayFastMerchantId,
  getPayFastPassphraseOrNull,
  PAYFAST_API_BASE,
} from "@/lib/payments/providers/payfast-config";
import { encodePayFastPhpUrlencode, omitEmptyPayFastFields } from "@/lib/payments/providers/payfast-signature";
import { createHash } from "crypto";

export type PayFastHistoryTransaction = {
  mPaymentId: string | null;
  pfPaymentId: string;
  gross: number;
  fee: number;
  net: number;
  fundingType: string | null;
  type: string | null;
  date: string | null;
};

function payFastApiTimestamp(): string {
  return new Date().toISOString().split(".")[0];
}

/** REST API signatures include passphrase as a sorted field (not appended). */
export function generatePayFastApiSignature(data: Record<string, string>): string {
  const cleaned = omitEmptyPayFastFields(data);
  const passphrase = getPayFastPassphraseOrNull();
  if (passphrase) cleaned.passphrase = passphrase;

  const keys = Object.keys(cleaned).sort();
  const pairs: string[] = [];
  for (const key of keys) {
    pairs.push(`${key}=${encodePayFastPhpUrlencode(String(cleaned[key]), true)}`);
  }
  return createHash("md5").update(pairs.join("&")).digest("hex");
}

function buildPayFastApiHeaders(queryParams: Record<string, string>) {
  const merchantId = getPayFastMerchantId();
  const timestamp = payFastApiTimestamp();
  const signaturePayload = {
    ...queryParams,
    "merchant-id": merchantId,
    version: "v1",
    timestamp,
  };
  const signature = generatePayFastApiSignature(signaturePayload);
  return {
    "merchant-id": merchantId,
    version: "v1",
    timestamp,
    signature,
  };
}

function parseMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value);
  const raw = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function normalizeHistoryRow(row: Record<string, unknown>): PayFastHistoryTransaction | null {
  const pfPaymentId = String(
    row.pf_payment_id ?? row["PF Payment ID"] ?? row.pfPaymentId ?? "",
  ).trim();
  if (!pfPaymentId) return null;

  const mPaymentIdRaw = row.m_payment_id ?? row["M Payment ID"] ?? row.mPaymentId;
  const mPaymentId = mPaymentIdRaw != null && String(mPaymentIdRaw).trim() !== ""
    ? String(mPaymentIdRaw).trim()
    : null;

  const gross = parseMoney(row.gross ?? row.Gross);
  const feeRaw = row.fee ?? row.Fee;
  const fee = parseMoney(feeRaw);
  const net = parseMoney(row.net ?? row.Net ?? gross - fee);

  return {
    mPaymentId,
    pfPaymentId,
    gross,
    fee,
    net,
    fundingType: row.funding_type != null
      ? String(row.funding_type)
      : row["Funding Type"] != null
        ? String(row["Funding Type"])
        : null,
    type: row.type != null ? String(row.type) : row.Type != null ? String(row.Type) : null,
    date: row.date != null ? String(row.date) : row.Date != null ? String(row.Date) : null,
  };
}

function parseHistoryResponseBody(text: string): PayFastHistoryTransaction[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { data?: unknown }).data)
          ? ((parsed as { data: Record<string, unknown>[] }).data ?? [])
          : [];
      return rows
        .map((row) => normalizeHistoryRow(row as Record<string, unknown>))
        .filter((row): row is PayFastHistoryTransaction => row != null);
    } catch {
      return [];
    }
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const out: PayFastHistoryTransaction[] = [];
  for (const line of lines.slice(1)) {
    const values = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    const normalized = normalizeHistoryRow(row);
    if (normalized) out.push(normalized);
  }
  return out;
}

function formatPayFastDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchPayFastDailyHistory(date: Date): Promise<PayFastHistoryTransaction[]> {
  const queryParams = {
    date: formatPayFastDate(date),
    offset: "0",
    limit: "1000",
  };
  const headers = buildPayFastApiHeaders(queryParams);
  const url = `${PAYFAST_API_BASE}/transactions/history/daily?${new URLSearchParams(queryParams).toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("PayFast transaction history request failed", { status: res.status, date: queryParams.date });
    return [];
  }

  const text = await res.text();
  return parseHistoryResponseBody(text);
}

/** Look up a settled PayFast payment by our m_payment_id (PaymentRecord id). */
export async function findPayFastTransactionByMPaymentId(
  mPaymentId: string,
  createdAt: Date,
): Promise<PayFastHistoryTransaction | null> {
  const datesToCheck = [
    createdAt,
    new Date(createdAt.getTime() - 24 * 60 * 60 * 1000),
    new Date(),
  ];

  const seen = new Set<string>();
  for (const date of datesToCheck) {
    const key = formatPayFastDate(date);
    if (seen.has(key)) continue;
    seen.add(key);

    const rows = await fetchPayFastDailyHistory(date);
    const match = rows.find((row) => row.mPaymentId === mPaymentId);
    if (match) return match;
  }

  return null;
}

export type PayFastRefundResult =
  | { ok: true; status: string; amountCents: number }
  | { ok: false; error: string; status?: string };

/**
 * Refund a completed PayFast payment (e.g. R5 card-verification charge) back to the card.
 * Queries refundability first, then creates a PAYMENT_SOURCE refund when available.
 */
export async function refundPayFastPayment(args: {
  pfPaymentId: string;
  amountZar: number;
  reason?: string;
}): Promise<PayFastRefundResult> {
  const pfPaymentId = args.pfPaymentId.trim();
  if (!pfPaymentId) return { ok: false, error: "missing_pf_payment_id" };

  const amountCents = Math.max(1, Math.round(Math.abs(args.amountZar) * 100));
  const reason = (args.reason?.trim() || "Story Time card verification refund").slice(0, 255);

  try {
    const queryHeaders = buildPayFastApiHeaders({});
    const queryRes = await fetch(`${PAYFAST_API_BASE}/refunds/query/${encodeURIComponent(pfPaymentId)}`, {
      method: "GET",
      headers: queryHeaders,
      cache: "no-store",
    });
    const queryJson = (await queryRes.json().catch(() => null)) as {
      status?: string;
      amount_available_for_refund?: number;
      refund_full?: { method?: string };
      errors?: string[];
    } | null;

    if (!queryRes.ok) {
      return {
        ok: false,
        error: `refund_query_failed_${queryRes.status}`,
        status: queryJson?.status,
      };
    }

    const status = String(queryJson?.status ?? "").toUpperCase();
    if (status === "COMPLETED") {
      return { ok: true, status: "COMPLETED", amountCents };
    }
    if (status !== "REFUNDABLE") {
      return {
        ok: false,
        error: `not_refundable:${status || "unknown"}`,
        status,
      };
    }

    const method = String(queryJson?.refund_full?.method ?? "").toUpperCase();
    if (method !== "PAYMENT_SOURCE") {
      return {
        ok: false,
        error: `refund_method_unavailable:${method || "none"}`,
        status,
      };
    }

    const available = Number(queryJson?.amount_available_for_refund ?? 0);
    const refundCents = available > 0 ? Math.min(amountCents, available) : amountCents;

    const body: Record<string, string> = {
      amount: String(refundCents),
      reason,
      notify_buyer: "1",
      notify_merchant: "0",
    };

    const merchantId = getPayFastMerchantId();
    const timestamp = payFastApiTimestamp();
    const signature = generatePayFastApiSignature({
      ...body,
      "merchant-id": merchantId,
      version: "v1",
      timestamp,
    });

    const createRes = await fetch(`${PAYFAST_API_BASE}/refunds/${encodeURIComponent(pfPaymentId)}`, {
      method: "POST",
      headers: {
        "merchant-id": merchantId,
        version: "v1",
        timestamp,
        signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      console.warn("PayFast refund create failed", {
        pfPaymentId,
        status: createRes.status,
        body: errText.slice(0, 300),
      });
      return { ok: false, error: `refund_create_failed_${createRes.status}`, status };
    }

    return { ok: true, status: "REQUESTED", amountCents: refundCents };
  } catch (error) {
    console.error("PayFast refund error", error);
    return { ok: false, error: error instanceof Error ? error.message : "refund_error" };
  }
}
