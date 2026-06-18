import "server-only";

import { prisma } from "@/lib/prisma";
import { DEMO_PAYMENT_PROVIDER } from "@/lib/payments/config";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";
import { allocateGatewayPaymentLedger } from "@/lib/payments/gateway-allocation";

const db = prisma as any;

export type CompleteGatewayPaymentResult =
  | { ok: true; already?: boolean; paymentRecordId: string }
  | { ok: false; error: string; status: number };

type CompleteGatewayPaymentOptions = {
  /** Backwards-compatible gateway transaction/reference id. */
  reference?: string;
  /** Merchant reference sent to PayFast as m_payment_id. */
  gatewayReference?: string;
  /** PayFast's pf_payment_id or saved-card transaction id. */
  gatewayTransactionId?: string;
  provider?: string;
  signatureVerified?: boolean;
  payload?: Record<string, unknown>;
};

/** Mark a gateway payment SUCCEEDED and run treasury + domain settlement. */
export async function completeGatewayPayment(
  paymentRecordId: string,
  options?: CompleteGatewayPaymentOptions,
): Promise<CompleteGatewayPaymentResult> {
  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
  });

  if (!payment) {
    return { ok: false, error: "Payment not found.", status: 404 };
  }

  const now = new Date();
  const provider = options?.provider ?? payment.provider ?? DEMO_PAYMENT_PROVIDER;
  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};
  const gatewayReference =
    options?.gatewayReference ??
    (typeof metadata.gatewayReference === "string" ? metadata.gatewayReference : null);
  const gatewayTransactionId =
    options?.gatewayTransactionId ??
    options?.reference ??
    (typeof metadata.gatewayTransactionId === "string" ? metadata.gatewayTransactionId : null);

  const updatedPayment = await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      status: "SUCCEEDED",
      paidAt: payment.paidAt ?? now,
      failedAt: null,
      failureReason: null,
      provider,
      ...(gatewayReference && (!payment.gatewayReference || payment.gatewayReference === gatewayReference)
        ? { gatewayReference }
        : {}),
      ...(gatewayTransactionId ? { gatewayTransactionId } : {}),
      metadata: {
        ...metadata,
        gatewayReference: gatewayReference ?? metadata.gatewayReference ?? null,
        gatewayTransactionId: gatewayTransactionId ?? metadata.gatewayTransactionId ?? null,
        gatewayCompletedAt: metadata.gatewayCompletedAt ?? now.toISOString(),
      },
    },
  });

  const invoiceId = typeof metadata.invoiceId === "string" ? metadata.invoiceId : null;
  if (invoiceId) {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: now },
    }).catch(() => {});
  }

  await recordGatewayEventIfNew({
    provider,
    eventType: "payment.succeeded",
    eventId: gatewayTransactionId ?? gatewayReference ?? paymentRecordId,
    payload: {
      paymentRecordId,
      gatewayReference,
      gatewayTransactionId,
      mode: provider === DEMO_PAYMENT_PROVIDER ? "demo" : "live",
      ...(options?.payload ?? {}),
    },
    signatureVerified: options?.signatureVerified ?? provider === DEMO_PAYMENT_PROVIDER,
    processed: true,
    processedAt: now,
  });

  await allocateGatewayPaymentLedger({
    id: paymentRecordId,
    amount: payment.amount,
    purpose: payment.purpose,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  }).catch((err: unknown) => {
    console.error("gateway allocation skipped", err);
  });

  await applyPaymentRecordSettlementEffects({
    id: updatedPayment.id,
    userId: updatedPayment.userId,
    purpose: updatedPayment.purpose,
    amount: updatedPayment.amount,
    relatedEntityType: updatedPayment.relatedEntityType,
    relatedEntityId: updatedPayment.relatedEntityId,
    metadata: updatedPayment.metadata,
    paidAt: updatedPayment.paidAt,
    createdAt: updatedPayment.createdAt,
  });

  return { ok: true, already: payment.status === "SUCCEEDED", paymentRecordId };
}

/** Mark a pending payment as failed (demo checkout cancel). */
export async function failGatewayPayment(
  paymentRecordId: string,
  reason?: string,
): Promise<CompleteGatewayPaymentResult> {
  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    return { ok: false, error: "Payment not found.", status: 404 };
  }
  if (payment.status === "SUCCEEDED") {
    return { ok: false, error: "Payment already completed.", status: 409 };
  }

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      status: "FAILED",
      metadata: {
        ...(payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {}),
        failReason: reason ?? "demo_checkout_declined",
      },
    },
  });

  return { ok: true, paymentRecordId };
}

/** Demo card consent — store a fake saved-card token on the subscription. */
export async function completeDemoCardConsent(params: {
  reference: string;
  userId: string;
}): Promise<CompleteGatewayPaymentResult> {
  const subscriptionId = params.reference.startsWith("trial-consent-")
    ? params.reference.slice("trial-consent-".length)
    : null;

  if (!subscriptionId) {
    return { ok: false, error: "Invalid consent reference.", status: 400 };
  }

  const subscription = await db.viewerSubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true },
  });

  if (!subscription || subscription.userId !== params.userId) {
    return { ok: false, error: "Subscription not found.", status: 404 };
  }

  await db.viewerSubscription.update({
    where: { id: subscriptionId },
    data: {
      externalPaymentId: `demo-consent-${subscriptionId}`,
      lastPaymentStatus: "SUCCEEDED",
      lastPaymentError: null,
    },
  });

  await recordGatewayEventIfNew({
    provider: DEMO_PAYMENT_PROVIDER,
    eventType: "card_consent.succeeded",
    eventId: params.reference,
    payload: { subscriptionId, mode: "demo" },
    signatureVerified: true,
  });

  return { ok: true, paymentRecordId: subscriptionId };
}
