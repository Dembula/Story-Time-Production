import "server-only";

import { prisma } from "@/lib/prisma";
import { DEMO_PAYMENT_PROVIDER } from "@/lib/payments/config";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";
import { allocateGatewayPaymentLedger } from "@/lib/payments/gateway-allocation";
import {
  demoPayFastSettlement,
  getPaymentSettlementAmount,
  type PayFastSettlementBreakdown,
} from "@/lib/payments/payfast-settlement";

const db = prisma as any;

export type CompleteGatewayPaymentResult =
  | { ok: true; already?: boolean; paymentRecordId: string }
  | { ok: false; error: string; status: number };

export type CompleteGatewayPaymentOptions = {
  reference?: string;
  provider?: string;
  settlement?: PayFastSettlementBreakdown;
};

function resolveSettlement(
  payment: { amount: number; provider?: string | null },
  settlement?: PayFastSettlementBreakdown,
): PayFastSettlementBreakdown {
  if (settlement) return settlement;
  if ((payment.provider ?? "") === DEMO_PAYMENT_PROVIDER) {
    return demoPayFastSettlement(payment.amount);
  }
  return demoPayFastSettlement(payment.amount);
}

/** Persist PayFast fee / net settlement on a payment record (ITN backfill or completion). */
export async function persistPaymentSettlement(
  paymentRecordId: string,
  settlement: PayFastSettlementBreakdown,
) {
  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      providerPaymentMethod: settlement.providerPaymentMethod,
      providerFeeAmount: settlement.providerFeeAmount,
      settlementAmount: settlement.settlementAmount,
      settlementSource: settlement.settlementSource,
    },
  });
}

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

  const settlement = resolveSettlement(payment, options?.settlement);
  const allocatableAmount = getPaymentSettlementAmount({
    amount: payment.amount,
    settlementAmount: settlement.settlementAmount,
  });

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      status: "SUCCEEDED",
      paidAt: now,
      provider,
      gatewayReference: options?.reference ?? payment.gatewayReference ?? undefined,
      providerPaymentId: options?.reference ?? payment.providerPaymentId ?? undefined,
      providerItnStatus: "COMPLETE",
      providerPaymentMethod: settlement.providerPaymentMethod,
      providerFeeAmount: settlement.providerFeeAmount,
      settlementAmount: settlement.settlementAmount,
      settlementSource: settlement.settlementSource,
      metadata: {
        ...metadata,
        demoCompletedAt: now.toISOString(),
        gatewayReference: options?.reference ?? metadata.gatewayReference ?? null,
        payfastSettlement: {
          amountGross: settlement.amountGross,
          providerFeeAmount: settlement.providerFeeAmount,
          settlementAmount: settlement.settlementAmount,
          providerPaymentMethod: settlement.providerPaymentMethod,
          providerPaymentMethodLabel: settlement.providerPaymentMethodLabel,
          settlementSource: settlement.settlementSource,
        },
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
    payload: {
      paymentRecordId,
      mode: provider === DEMO_PAYMENT_PROVIDER ? "demo" : "live",
      settlementAmount: allocatableAmount,
      providerFeeAmount: settlement.providerFeeAmount,
    },
    signatureVerified: provider === DEMO_PAYMENT_PROVIDER ? true : Boolean(options?.reference),
  });

  await allocateGatewayPaymentLedger({
    id: paymentRecordId,
    amount: payment.amount,
    settlementAmount: allocatableAmount,
    providerFeeAmount: settlement.providerFeeAmount,
    purpose: payment.purpose,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  }).catch((err: unknown) => {
    console.error("gateway allocation skipped", err);
  });

  await applyPaymentRecordSettlementEffects({
    id: paymentRecordId,
    userId: payment.userId,
    purpose: payment.purpose,
    amount: payment.amount,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
    metadata: {
      ...metadata,
      payfastSettlement: settlement,
    },
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

/** Demo card consent for viewer trial onboarding only — not wallet save-card flows. */
export async function completeDemoCardConsent(params: {
  reference: string;
  userId: string;
}): Promise<CompleteGatewayPaymentResult> {
  if (params.reference.startsWith("card-consent-")) {
    return {
      ok: false,
      error: "Wallet card saving requires PayFast. Demo mode is not supported.",
      status: 400,
    };
  }

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
