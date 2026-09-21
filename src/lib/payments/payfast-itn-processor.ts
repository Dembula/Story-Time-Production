import "server-only";

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { completeGatewayPayment, persistPaymentSettlement } from "@/lib/payments/complete-gateway-payment";
import { getPayFastTokenForUser, isPayFastChargeToken, upsertPayFastPaymentMethod } from "@/lib/payments/payfast-saved-card";
import { addViewerSubscriptionPeriod } from "@/lib/payments/billing-interval";
import { resolvePaymentRecordIdFromPayFastItn } from "@/lib/payments/resolve-itn-payment-record";
import { parsePayFastSettlementFromItn } from "@/lib/payments/payfast-settlement";
import { findStoredItnWebhookForPayment } from "@/lib/payments/pending-gateway-payment";
import { findPayFastTransactionByMPaymentId, refundPayFastPayment } from "@/lib/payments/providers/payfast-api-client";
import { PAYFAST_CARD_CONSENT_AMOUNT_ZAR, PAYFAST_VALIDATE_URL } from "@/lib/payments/providers/payfast-config";
import {
  buildPayFastItnValidatePayload,
  parsePayFastFormBody,
  verifyPayFastItnSignature,
} from "@/lib/payments/providers/payfast-signature";

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
    const validatePayload = buildPayFastItnValidatePayload(rawBody);
    if (!validatePayload) return false;

    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: validatePayload,
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

async function markCardConsentPaymentSucceeded(args: {
  paymentRecordId?: string | null;
  consentReference?: string | null;
  payerUserId?: string | null;
}) {
  if (args.paymentRecordId?.trim()) {
    await db.paymentRecord.update({
      where: { id: args.paymentRecordId.trim() },
      data: { status: "SUCCEEDED", paidAt: new Date() },
    }).catch(() => {});
    return;
  }

  const consentReference = args.consentReference?.trim();
  const payerUserId = args.payerUserId?.trim();
  if (!payerUserId || !consentReference) return;

  const pending = await db.paymentRecord.findMany({
    where: {
      userId: payerUserId,
      purpose: "CARD_CONSENT",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const matched = pending.find((record: { metadata?: unknown }) => {
    const meta =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : {};
    return meta.consentReference === consentReference;
  });

  const target = matched ?? pending[0];
  if (!target) return;

  await db.paymentRecord.update({
    where: { id: target.id },
    data: { status: "SUCCEEDED", paidAt: new Date() },
  });
}

async function refundCardConsentVerificationCharge(args: {
  paymentRecordId?: string | null;
  pfPaymentId?: string | null;
  amountZar?: number;
}) {
  const pfPaymentId = args.pfPaymentId?.trim();
  if (!pfPaymentId) return;

  const amountZar = args.amountZar && args.amountZar > 0 ? args.amountZar : PAYFAST_CARD_CONSENT_AMOUNT_ZAR;

  if (args.paymentRecordId) {
    const existing = await db.paymentRecord.findUnique({
      where: { id: args.paymentRecordId },
      select: { metadata: true },
    });
    const existingMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};
    if (existingMeta.verificationRefund === "refunded") return;
  }

  const result = await refundPayFastPayment({
    pfPaymentId,
    amountZar,
    reason: "Story Time R1 card verification refund",
  });

  if (!args.paymentRecordId) {
    if (!result.ok) console.warn("payfast card consent refund failed", result);
    return;
  }

  const payment = await db.paymentRecord.findUnique({
    where: { id: args.paymentRecordId },
    select: { metadata: true },
  });
  const meta =
    payment?.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};

  await db.paymentRecord.update({
    where: { id: args.paymentRecordId },
    data: {
      metadata: {
        ...meta,
        verificationRefund: result.ok ? "refunded" : "failed",
        verificationRefundAt: new Date().toISOString(),
        verificationRefundDetail: result.ok
          ? { status: result.status, amountCents: result.amountCents }
          : { error: result.error, status: result.status ?? null },
      },
      ...(pfPaymentId ? { providerPaymentId: pfPaymentId } : {}),
    },
  }).catch((err: unknown) => console.error("payfast card consent refund metadata update failed", err));

  if (!result.ok) {
    console.warn("payfast card consent refund failed", {
      paymentRecordId: args.paymentRecordId,
      pfPaymentId,
      error: result.error,
    });
  }
}

const TRIAL_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;

function isCardConsentItn(data: Record<string, string>): boolean {
  const flow = (data.custom_str2 ?? "").trim().toLowerCase();
  if (flow === "card_consent") return true;
  const reference = (data.custom_str3 ?? data.m_payment_id ?? "").trim();
  return reference.startsWith("trial-consent-") || reference.startsWith("card-consent-");
}

async function handleCardConsentItn(
  data: Record<string, string>,
  paymentRecordIdHint?: string | null,
): Promise<PayFastItnProcessResult> {
  const paymentStatus = (data.payment_status ?? "").toUpperCase();
  const token = (data.token ?? "").trim();
  const hasToken = isPayFastChargeToken(token);

  // Resolve PaymentRecord first (m_payment_id / custom_str1 are now the record id).
  let paymentRecordId =
    paymentRecordIdHint?.trim() ||
    (await resolvePaymentRecordIdFromPayFastItn(data));

  let payment: {
    id: string;
    userId: string | null;
    purpose: string;
    status: string;
    email: string | null;
    metadata: unknown;
  } | null = null;

  if (paymentRecordId) {
    payment = await db.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      select: { id: true, userId: true, purpose: true, status: true, email: true, metadata: true },
    });
  }

  // Legacy ITNs used consent reference as m_payment_id — match via metadata.
  if (!payment) {
    const consentRef = (data.custom_str3 ?? data.m_payment_id ?? "").trim();
    if (consentRef) {
      const recent = await db.paymentRecord.findMany({
        where: { purpose: "CARD_CONSENT", status: { in: ["PENDING", "SUCCEEDED"] } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, userId: true, purpose: true, status: true, email: true, metadata: true },
      });
      payment =
        recent.find((row: { metadata?: unknown }) => {
          const meta =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {};
          return meta.consentReference === consentRef;
        }) ?? null;
      if (payment) paymentRecordId = payment.id;
    }
  }

  const meta =
    payment?.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};
  const consentReference =
    (typeof meta.consentReference === "string" && meta.consentReference.trim()) ||
    (data.custom_str3 ?? "").trim() ||
    (data.m_payment_id ?? "").trim();

  const payerUserId =
    payment?.userId?.trim() ||
    (data.custom_str4 ?? "").trim() ||
    // Legacy: custom_str1 used to be the user id (only when it is not a PaymentRecord id).
    (payment ? null : (data.custom_str1 ?? "").trim()) ||
    null;

  // Failed / cancelled authorization — mark and stop.
  if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
    if (paymentRecordId) {
      await db.paymentRecord.update({
        where: { id: paymentRecordId },
        data: { status: paymentStatus === "CANCELLED" ? "CANCELLED" : "FAILED" },
      }).catch(() => {});
    }
    return { ok: true, cardConsent: true, paymentRecordId: paymentRecordId ?? undefined };
  }

  // Incomplete without a token — acknowledge so PayFast stops retrying; return sync will keep polling.
  if (paymentStatus && paymentStatus !== "COMPLETE") {
    return { ok: true, cardConsent: true, paymentRecordId: paymentRecordId ?? undefined };
  }

  if (!hasToken) {
    console.warn("payfast card consent ITN missing token", {
      paymentRecordId,
      paymentStatus,
      m_payment_id: data.m_payment_id,
    });
    return { ok: true, cardConsent: true, paymentRecordId: paymentRecordId ?? undefined };
  }

  if (consentReference.startsWith("trial-consent-")) {
    const subscriptionId = consentReference.slice("trial-consent-".length);
    if (subscriptionId) {
      const sub = await db.viewerSubscription.findUnique({
        where: { id: subscriptionId },
        select: {
          id: true,
          userId: true,
          status: true,
          trialEndsAt: true,
          externalPaymentId: true,
          user: { select: { email: true } },
        },
      });
      if (sub?.id) {
        const alreadyStarted =
          sub.status === "TRIAL_ACTIVE" &&
          !!sub.trialEndsAt &&
          isPayFastChargeToken(sub.externalPaymentId);
        if (sub.status === "TRIAL_CARD_PENDING" || (sub.status === "TRIAL_ACTIVE" && !alreadyStarted)) {
          const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_MS);
          await db.viewerSubscription.update({
            where: { id: subscriptionId },
            data: {
              status: "TRIAL_ACTIVE",
              trialEndsAt,
              currentPeriodEnd: addViewerSubscriptionPeriod(trialEndsAt),
              externalPaymentId: token,
              lastPaymentStatus: "SUCCEEDED",
              lastPaymentError: null,
            },
          });
        } else if (sub.status === "TRIAL_ACTIVE" || sub.status === "ACTIVE") {
          await db.viewerSubscription.update({
            where: { id: subscriptionId },
            data: {
              externalPaymentId: token,
              lastPaymentStatus: "SUCCEEDED",
              lastPaymentError: null,
            },
          });
        }

        const ownerId = sub.userId ?? payerUserId;
        if (ownerId) {
          await upsertPayFastPaymentMethod({
            userId: ownerId,
            token,
            email: sub.user?.email ?? data.email_address ?? payment?.email,
            label: data.payment_method ? String(data.payment_method) : undefined,
            lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
            cardType: data.payment_method ? String(data.payment_method) : undefined,
          }).catch((err: unknown) => console.error("payfast method upsert failed", err));
        }
        await markCardConsentPaymentSucceeded({
          paymentRecordId,
          consentReference,
          payerUserId: ownerId,
        });
        await refundCardConsentVerificationCharge({
          paymentRecordId,
          pfPaymentId: data.pf_payment_id,
          amountZar:
            typeof meta.verificationAmountZar === "number"
              ? meta.verificationAmountZar
              : PAYFAST_CARD_CONSENT_AMOUNT_ZAR,
        }).catch((err: unknown) => console.error("payfast verification refund failed", err));
        return { ok: true, cardConsent: true, paymentRecordId: paymentRecordId ?? undefined };
      }
    }
  }

  if (payerUserId) {
    await upsertPayFastPaymentMethod({
      userId: payerUserId,
      token,
      email: data.email_address ?? payment?.email,
      label: data.payment_method ? String(data.payment_method) : undefined,
      lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
      cardType: data.payment_method ? String(data.payment_method) : undefined,
    }).catch((err: unknown) => console.error("payfast method upsert failed", err));

    const activeSub = await db.viewerSubscription.findFirst({
      where: { userId: payerUserId, viewerModel: "SUBSCRIPTION", status: { in: ["ACTIVE", "TRIALING", "TRIAL_ACTIVE"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (activeSub?.id) {
      await db.viewerSubscription.update({
        where: { id: activeSub.id },
        data: {
          externalPaymentId: token,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentError: null,
        },
      }).catch(() => {});
    }

    await markCardConsentPaymentSucceeded({
      paymentRecordId,
      consentReference,
      payerUserId,
    });
    await refundCardConsentVerificationCharge({
      paymentRecordId,
      pfPaymentId: data.pf_payment_id,
      amountZar:
        typeof meta.verificationAmountZar === "number"
          ? meta.verificationAmountZar
          : PAYFAST_CARD_CONSENT_AMOUNT_ZAR,
    }).catch((err: unknown) => console.error("payfast verification refund failed", err));
  } else {
    console.warn("payfast card consent ITN could not resolve payer user", {
      paymentRecordId,
      consentReference,
    });
  }

  return { ok: true, cardConsent: true, paymentRecordId: paymentRecordId ?? undefined };
}

export async function processPayFastItn(
  rawBody: string,
  options?: { skipRemoteValidate?: boolean; requireSignature?: boolean },
): Promise<PayFastItnProcessResult> {
  const data = parsePayFastFormBody(rawBody);
  const signatureVerified = verifyPayFastItnSignature(data, data.signature, rawBody);

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
  const paymentRecordId = paymentRecordIdPreview;

  // Card consent / tokenization — detect by custom fields OR CARD_CONSENT payment purpose.
  let cardConsentPaymentPurpose = false;
  if (paymentRecordId) {
    const purposeRow = await db.paymentRecord.findUnique({
      where: { id: paymentRecordId },
      select: { purpose: true },
    });
    cardConsentPaymentPurpose = purposeRow?.purpose === "CARD_CONSENT";
  }

  if (isCardConsentItn(data) || cardConsentPaymentPurpose) {
    const result = await handleCardConsentItn(data, paymentRecordId);
    await persistPayFastItn({
      rawBody,
      data,
      signatureVerified,
      paymentRecordId: (result.ok ? result.paymentRecordId : undefined) ?? paymentRecordId,
      processed: true,
    });
    return result;
  }

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

async function completeFromPayFastHistory(paymentRecordId: string): Promise<PayFastItnProcessResult> {
  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    return { ok: false, status: 404, error: "Payment not found" };
  }
  if (payment.status === "SUCCEEDED") {
    return { ok: true, paymentRecordId, already: true };
  }

  const meta =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};
  const consentReference =
    typeof meta.consentReference === "string" ? meta.consentReference.trim() : "";

  // Prefer PaymentRecord id (current). Also try legacy consent reference m_payment_id.
  const lookupIds = [paymentRecordId, consentReference].filter(Boolean);

  let transaction = null;
  try {
    for (const mPaymentId of lookupIds) {
      transaction = await findPayFastTransactionByMPaymentId(mPaymentId, new Date(payment.createdAt));
      if (transaction) break;
    }
  } catch (err) {
    console.error("PayFast history lookup failed", { paymentRecordId, err });
    return { ok: false, status: 202, error: "Awaiting PayFast confirmation" };
  }

  if (!transaction) {
    return { ok: false, status: 202, error: "Awaiting PayFast confirmation" };
  }

  if (transaction.gross > 0 && !amountsMatch(Number(payment.amount), transaction.gross)) {
    return { ok: false, status: 400, error: "Amount mismatch" };
  }

  // R0 card consent: history confirms the auth, but the reusable token only arrives via ITN.
  // Do not mark SUCCEEDED from history alone — return sync will flip once the token ITN lands
  // (or once getPayFastTokenForUser already has a token).
  if (payment.purpose === "CARD_CONSENT") {
    await db.paymentRecord.update({
      where: { id: paymentRecordId },
      data: {
        providerPaymentId: transaction.pfPaymentId,
        providerItnStatus: "COMPLETE",
      },
    }).catch(() => {});
    return { ok: false, status: 202, error: "Awaiting PayFast card token" };
  }

  const settlementFields: Record<string, string> = {
    amount_gross: transaction.gross.toFixed(2),
    amount_net: transaction.net.toFixed(2),
    payment_status: "COMPLETE",
  };
  if (transaction.fee > 0) {
    settlementFields.amount_fee = (-transaction.fee).toFixed(2);
  }
  if (transaction.fundingType) {
    settlementFields.payment_method = transaction.fundingType;
  }

  const settlement = parsePayFastSettlementFromItn(settlementFields, Number(payment.amount));

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      providerPaymentId: transaction.pfPaymentId,
      providerItnStatus: "COMPLETE",
    },
  }).catch(() => {});

  const result = await completeGatewayPayment(paymentRecordId, {
    reference: transaction.pfPaymentId,
    provider: PAYMENT_PROVIDER,
    settlement,
  });

  if (!result.ok && result.status !== 409) {
    return { ok: false, status: result.status, error: result.error };
  }

  await persistPayFastItn({
    rawBody: `source=payfast_api&m_payment_id=${encodeURIComponent(paymentRecordId)}&pf_payment_id=${encodeURIComponent(transaction.pfPaymentId)}`,
    data: {
      m_payment_id: paymentRecordId,
      pf_payment_id: transaction.pfPaymentId,
      payment_status: "COMPLETE",
      amount_gross: transaction.gross.toFixed(2),
      amount_fee: transaction.fee > 0 ? (-transaction.fee).toFixed(2) : "",
      amount_net: transaction.net.toFixed(2),
      payment_method: transaction.fundingType ?? "",
    },
    signatureVerified: true,
    paymentRecordId,
    processed: true,
  });

  return { ok: true, paymentRecordId, already: result.ok && "already" in result ? result.already : false };
}

/** Process PayFast fields captured from the browser return redirect (when ITN is delayed). */
export async function processPayFastReturnFields(
  paymentRecordId: string,
  fields: Record<string, string>,
): Promise<PayFastItnProcessResult> {
  const cleaned = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => String(value ?? "").trim() !== ""),
  ) as Record<string, string>;

  if (!cleaned.m_payment_id) cleaned.m_payment_id = paymentRecordId;
  // Never overwrite a real custom_str1 (user id or payment id) with a guess when absent —
  // always ensure payment record id is present for resolve.
  if (!cleaned.custom_str1) cleaned.custom_str1 = paymentRecordId;

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: { purpose: true, metadata: true, userId: true },
  });
  if (payment?.purpose === "CARD_CONSENT") {
    cleaned.custom_str2 = cleaned.custom_str2 || "card_consent";
    const meta =
      payment.metadata && typeof payment.metadata === "object"
        ? (payment.metadata as Record<string, unknown>)
        : {};
    if (!cleaned.custom_str3 && typeof meta.consentReference === "string") {
      cleaned.custom_str3 = meta.consentReference;
    }
    if (!cleaned.custom_str4 && payment.userId) {
      cleaned.custom_str4 = payment.userId;
    }
  }

  const rawBody = Object.entries(cleaned)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return processPayFastItn(rawBody, { skipRemoteValidate: true, requireSignature: false });
}

/** Replay ITN, process return fields, or poll PayFast transaction history for a pending payment. */
export async function syncPayFastPaymentRecord(
  paymentRecordId: string,
  options?: { returnFields?: Record<string, string> },
): Promise<PayFastItnProcessResult> {
  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    return { ok: false, status: 404, error: "Payment not found" };
  }
  if (payment.status === "SUCCEEDED") {
    return { ok: true, paymentRecordId, already: true };
  }

  // Card already tokenized via an earlier ITN that failed to flip PaymentRecord status.
  if (payment.purpose === "CARD_CONSENT" && payment.userId) {
    const existing = await getPayFastTokenForUser(payment.userId);
    if (existing?.token) {
      await db.paymentRecord.update({
        where: { id: paymentRecordId },
        data: { status: "SUCCEEDED", paidAt: new Date() },
      }).catch(() => {});
      return { ok: true, paymentRecordId, cardConsent: true };
    }
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

  if (options?.returnFields && Object.keys(options.returnFields).length > 0) {
    const fromReturn = await processPayFastReturnFields(paymentRecordId, options.returnFields);
    if (fromReturn.ok) return fromReturn;
  }

  return completeFromPayFastHistory(paymentRecordId);
}
