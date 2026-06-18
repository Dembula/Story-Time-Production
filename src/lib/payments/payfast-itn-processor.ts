import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { completeGatewayPayment, persistPaymentSettlement } from "@/lib/payments/complete-gateway-payment";
import { isPayFastChargeToken, upsertPayFastPaymentMethod } from "@/lib/payments/payfast-saved-card";
import { resolvePaymentRecordIdFromPayFastItn } from "@/lib/payments/resolve-itn-payment-record";
import { parsePayFastSettlementFromItn } from "@/lib/payments/payfast-settlement";
import { findStoredItnWebhookForPayment } from "@/lib/payments/pending-gateway-payment";
import { PAYFAST_VALIDATE_URL } from "@/lib/payments/providers/payfast-config";
import { parsePayFastFormBody, verifyPayFastItnSignature } from "@/lib/payments/providers/payfast-signature";

const db = prisma as any;

export type PayFastItnProcessResult =
  | { ok: true; paymentRecordId?: string; already?: boolean; cardConsent?: boolean }
  | { ok: false; status: number; error: string };

function payFastItnEventId(data: Record<string, string>, rawBody: string): string {
  return (
    data.pf_payment_id?.trim() ||
    `${data.m_payment_id?.trim() || "itn"}-${createHash("md5").update(rawBody).digest("hex").slice(0, 16)}`
  );
}

async function persistPayFastItn(args: {
  rawBody: string;
  data: Record<string, string>;
  signatureVerified: boolean;
  paymentRecordId?: string | null;
  processingError?: string | null;
  processed?: boolean;
}) {
  const eventId = payFastItnEventId(args.data, args.rawBody);
  try {
    await db.paymentWebhookEvent.upsert({
      where: {
        provider_eventType_eventId: {
          provider: PAYMENT_PROVIDER,
          eventType: "itn",
          eventId,
        },
      },
      create: {
        provider: PAYMENT_PROVIDER,
        eventType: "itn",
        eventId,
        reference: args.paymentRecordId ?? null,
        payload: { rawBody: args.rawBody, fields: args.data },
        signatureVerified: args.signatureVerified,
        processingError: args.processingError ?? null,
        processedAt: args.processed ? new Date() : null,
      },
      update: {
        reference: args.paymentRecordId ?? undefined,
        payload: { rawBody: args.rawBody, fields: args.data },
        signatureVerified: args.signatureVerified,
        processingError: args.processingError ?? null,
        processedAt: args.processed ? new Date() : undefined,
      },
    });
  } catch (err) {
    console.error("payfast itn persist failed", err);
  }
}

async function validateItnWithPayFast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch {
    return false;
  }
}

function amountsMatch(expected: number, received: number): boolean {
  return Math.abs(expected - received) <= 0.05;
}

async function handleCardConsentItn(data: Record<string, string>): Promise<PayFastItnProcessResult> {
  const reference = data.custom_str3 ?? data.m_payment_id ?? "";
  const payerUserId = data.custom_str1?.trim() || null;

  if (reference.startsWith("trial-consent-")) {
    const subscriptionId = reference.slice("trial-consent-".length);
    if (subscriptionId && isPayFastChargeToken(data.token)) {
      await db.viewerSubscription.update({
        where: { id: subscriptionId },
        data: {
          externalPaymentId: data.token,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentError: null,
        },
      }).catch(() => {});

      const sub = await db.viewerSubscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true, user: { select: { email: true } } },
      });
      if (sub?.userId) {
        await upsertPayFastPaymentMethod({
          userId: sub.userId,
          token: data.token,
          email: sub.user?.email ?? data.email_address,
          label: data.payment_method ? String(data.payment_method) : undefined,
          lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
          cardType: data.payment_method ? String(data.payment_method) : undefined,
        }).catch((err: unknown) => console.error("payfast method upsert failed", err));
      }
    }
  } else if (payerUserId && isPayFastChargeToken(data.token)) {
    await upsertPayFastPaymentMethod({
      userId: payerUserId,
      token: data.token,
      email: data.email_address,
      label: data.payment_method ? String(data.payment_method) : undefined,
      lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
      cardType: data.payment_method ? String(data.payment_method) : undefined,
    }).catch((err: unknown) => console.error("payfast method upsert failed", err));

    await db.viewerSubscription.updateMany({
      where: { userId: payerUserId, viewerModel: "SUBSCRIPTION" },
      data: { externalPaymentId: data.token, lastPaymentStatus: "SUCCEEDED", lastPaymentError: null },
    }).catch(() => {});
  }

  return { ok: true, cardConsent: true };
}

export async function processPayFastItn(
  rawBody: string,
  options?: { skipRemoteValidate?: boolean; requireSignature?: boolean },
): Promise<PayFastItnProcessResult> {
  const data = parsePayFastFormBody(rawBody);
  const signatureVerified = verifyPayFastItnSignature(data, data.signature);

  const paymentRecordIdPreview = await resolvePaymentRecordIdFromPayFastItn(data);

  if (options?.requireSignature !== false && !signatureVerified) {
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified: false,
      paymentRecordId: paymentRecordIdPreview,
      processingError: "invalid_signature",
    });
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  const paymentStatus = (data.payment_status ?? "").toUpperCase();
  const pfPaymentId = data.pf_payment_id ?? "";
  const flow = data.custom_str2 ?? "";

  if (flow === "card_consent" && data.token) {
    const result = await handleCardConsentItn(data);
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId: paymentRecordIdPreview,
      processed: true,
    });
    return result;
  }

  const paymentRecordId = paymentRecordIdPreview;
  if (!paymentRecordId) {
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      processingError: "missing_payment_reference",
    });
    return { ok: false, status: 400, error: "Missing payment reference" };
  }

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      providerItnStatus: paymentStatus || null,
      ...(pfPaymentId ? { providerPaymentId: pfPaymentId } : {}),
    },
  }).catch(() => {});

  if (paymentStatus !== "COMPLETE") {
    if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
      await db.paymentRecord.update({
        where: { id: paymentRecordId },
        data: { status: paymentStatus === "CANCELLED" ? "CANCELLED" : "FAILED" },
      }).catch(() => {});
    }
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId,
      processed: true,
    });
    return { ok: true, paymentRecordId };
  }

  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId,
      processingError: "payment_not_found",
    });
    return { ok: false, status: 404, error: "Payment not found" };
  }

  if (payment.status === "SUCCEEDED") {
    const settlement = parsePayFastSettlementFromItn(data, Number(payment.amount));
    await persistPaymentSettlement(paymentRecordId, settlement).catch(() => {});
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId,
      processed: true,
    });
    return { ok: true, paymentRecordId, already: true };
  }

  const paidAmount = Number(data.amount_gross ?? data.amount ?? 0);
  if (Number.isFinite(paidAmount) && !amountsMatch(Number(payment.amount), paidAmount)) {
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId,
      processingError: `amount_mismatch expected=${payment.amount} received=${paidAmount}`,
    });
    return { ok: false, status: 400, error: "Amount mismatch" };
  }

  if (!options?.skipRemoteValidate) {
    const valid = await validateItnWithPayFast(rawBody);
    if (!valid) {
      console.warn("PayFast ITN remote validate returned non-VALID; continuing after signature check", {
        paymentRecordId,
        pfPaymentId,
      });
    }
  }

  const settlement = parsePayFastSettlementFromItn(data, Number(payment.amount));

  const result = await completeGatewayPayment(paymentRecordId, {
    reference: pfPaymentId || data.m_payment_id || paymentRecordId,
    provider: PAYMENT_PROVIDER,
    settlement,
  });

  if (data.token && payment.userId && isPayFastChargeToken(data.token)) {
    await upsertPayFastPaymentMethod({
      userId: payment.userId,
      token: data.token,
      email: data.email_address ?? payment.email,
      label: data.payment_method ? String(data.payment_method) : undefined,
      lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
      cardType: data.payment_method ? String(data.payment_method) : undefined,
    }).catch((err: unknown) => console.error("payfast checkout token save failed", err));
  }

  if (!result.ok && result.status !== 409) {
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId,
      processingError: result.error,
    });
    return { ok: false, status: result.status, error: result.error };
  }

  await persistPayFastItn({
    rawBody,
    data,
    signatureVerified,
    paymentRecordId,
    processed: true,
  });

  return { ok: true, paymentRecordId, already: result.ok && "already" in result ? result.already : false };
}

/** Replay a stored ITN or complete an already-received webhook for a pending payment. */
export async function syncPayFastPaymentRecord(paymentRecordId: string): Promise<PayFastItnProcessResult> {
  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    return { ok: false, status: 404, error: "Payment not found" };
  }
  if (payment.status === "SUCCEEDED") {
    return { ok: true, paymentRecordId, already: true };
  }

  const webhook = await findStoredItnWebhookForPayment(paymentRecordId);

  const payload = webhook?.payload as { rawBody?: string; fields?: Record<string, string> } | null;
  if (payload?.rawBody) {
    return processPayFastItn(payload.rawBody, { skipRemoteValidate: true, requireSignature: false });
  }

  if (payload?.fields) {
    const rawBody = new URLSearchParams(payload.fields).toString();
    return processPayFastItn(rawBody, { skipRemoteValidate: true, requireSignature: false });
  }

  return { ok: false, status: 202, error: "Awaiting PayFast confirmation" };
}
