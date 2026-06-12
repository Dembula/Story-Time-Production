import "server-only";

import { prisma } from "@/lib/prisma";
import { DEMO_PAYMENT_PROVIDER } from "@/lib/payments/config";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";
import { creditTreasuryFromGatewayPayment } from "@/lib/payments/treasury-inflow";

const db = prisma as any;

export type CompleteGatewayPaymentResult =
  | { ok: true; already?: boolean; paymentRecordId: string }
  | { ok: false; error: string; status: number };

/** Mark a gateway payment SUCCEEDED and run treasury + domain settlement. */
export async function completeGatewayPayment(
  paymentRecordId: string,
  options?: { reference?: string; provider?: string },
): Promise<CompleteGatewayPaymentResult> {
  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
  });

  if (!payment) {
    return { ok: false, error: "Payment not found.", status: 404 };
  }

  if (payment.status === "SUCCEEDED") {
    return { ok: true, already: true, paymentRecordId };
  }

  if (payment.status === "FAILED" || payment.status === "CANCELLED") {
    return { ok: false, error: "Payment is no longer pending.", status: 409 };
  }

  const now = new Date();
  const provider = options?.provider ?? payment.provider ?? DEMO_PAYMENT_PROVIDER;
  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      status: "SUCCEEDED",
      paidAt: now,
      provider,
      metadata: {
        ...metadata,
        demoCompletedAt: now.toISOString(),
        gatewayReference: options?.reference ?? metadata.gatewayReference ?? null,
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
    eventId: options?.reference ?? paymentRecordId,
    payload: { paymentRecordId, mode: provider === DEMO_PAYMENT_PROVIDER ? "demo" : "live" },
    signatureVerified: provider === DEMO_PAYMENT_PROVIDER,
  });

  await creditTreasuryFromGatewayPayment({
    id: paymentRecordId,
    amount: payment.amount,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  }).catch((err: unknown) => {
    console.error("treasury inflow skipped", err);
  });

  await applyPaymentRecordSettlementEffects({
    id: paymentRecordId,
    purpose: payment.purpose,
    amount: payment.amount,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  });

  return { ok: true, paymentRecordId };
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
