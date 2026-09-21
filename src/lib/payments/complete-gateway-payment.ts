import "server-only";

import { prisma } from "@/lib/prisma";
import { DEMO_PAYMENT_PROVIDER, PAYMENT_PROVIDER } from "@/lib/payments/config";
import { isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";
import {
  demoPayFastSettlement,
  estimatePayFastSettlement,
  estimatePayFastFee,
  getPaymentSettlementAmount,
  type PayFastSettlementBreakdown,
} from "@/lib/payments/payfast-settlement";
import {
  computeFundsClearDueAt,
  markPaymentFundsCleared,
  scheduleFundsClearForPayment,
} from "@/lib/payments/funds-clearing";

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
  provider: string,
  settlement?: PayFastSettlementBreakdown,
): PayFastSettlementBreakdown {
  if (settlement) return settlement;
  if (provider === DEMO_PAYMENT_PROVIDER || (payment.provider ?? "") === DEMO_PAYMENT_PROVIDER) {
    return demoPayFastSettlement(payment.amount);
  }
  // Live PayFast without ITN fields: estimate card fees rather than treating as demo (0 fee).
  return {
    amountGross: payment.amount,
    providerFeeAmount: estimatePayFastFee(payment.amount, "cc"),
    settlementAmount: estimatePayFastSettlement(payment.amount, "cc"),
    providerPaymentMethod: "cc",
    providerPaymentMethodLabel: "Estimated (credit card schedule)",
    settlementSource: "estimated",
  };
}

async function runPostSuccessMoneyAndEffects(args: {
  paymentRecordId: string;
  payment: {
    id: string;
    userId: string | null;
    amount: number;
    purpose: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    provider: string | null;
    metadata: unknown;
  };
  provider: string;
  settlement: PayFastSettlementBreakdown;
  metadata: Record<string, unknown>;
  isDemo: boolean;
  /** When true, skip domain effects if they were already applied (recovery path). */
  recovery?: boolean;
}) {
  const allocatableAmount = getPaymentSettlementAmount({
    amount: args.payment.amount,
    settlementAmount: args.settlement.settlementAmount,
  });

  const cashRecognized = isCashRecognizedPayment({
    amount: args.payment.amount,
    settlementAmount: args.settlement.settlementAmount,
    status: "SUCCEEDED",
    purpose: args.payment.purpose,
    provider: args.provider,
    metadata: {
      ...args.metadata,
      ...(args.isDemo ? { demoCompletedAt: new Date().toISOString() } : {}),
    },
    settlementSource: args.settlement.settlementSource,
  });

  if (cashRecognized && allocatableAmount > 0) {
    const { ensureCreatorRevenueTrackingLive, getRevenueConnector } = await import(
      "@/lib/finance/revenue-connector"
    );
    await ensureCreatorRevenueTrackingLive().catch(() => {});
    const connector = await getRevenueConnector();

    // Schedule PayFast (3d) / Apple (45d) clear clock — ledger books only after clear.
    const paidAt = new Date();
    const existing = await db.paymentRecord.findUnique({
      where: { id: args.paymentRecordId },
      select: {
        paidAt: true,
        fundsClearDueAt: true,
        fundsClearedAt: true,
        provider: true,
      },
    });
    const paidAtEffective = existing?.paidAt ? new Date(existing.paidAt) : paidAt;
    let dueAt =
      existing?.fundsClearDueAt != null ? new Date(existing.fundsClearDueAt) : null;
    if (!existing?.fundsClearDueAt && !existing?.fundsClearedAt) {
      const scheduled = await scheduleFundsClearForPayment({
        paymentRecordId: args.paymentRecordId,
        paidAt: paidAtEffective,
        provider: args.provider,
        trackingStartedAt: connector.trackingStartedAt,
      });
      if (scheduled.skipped || !scheduled.fundsClearDueAt) {
        // Pre-tracking: no clock, no early auto-clear into the pool.
      } else {
        dueAt = scheduled.fundsClearDueAt;
      }
    }

    // Clear now if due (or already past), including recovery for already-cleared rows.
    if (dueAt || existing?.fundsClearedAt) {
      const due = dueAt ?? computeFundsClearDueAt(paidAtEffective, args.provider);
      if (existing?.fundsClearedAt || due.getTime() <= Date.now()) {
        await markPaymentFundsCleared({
          paymentRecordId: args.paymentRecordId,
          mode: "auto",
          now: new Date(),
        });
      }
    }
  }

  const effectsAlreadyApplied = args.metadata.domainEffectsApplied === true;
  if (args.recovery && effectsAlreadyApplied) {
    return;
  }

  await applyPaymentRecordSettlementEffects({
    id: args.paymentRecordId,
    userId: args.payment.userId,
    purpose: args.payment.purpose,
    amount: args.payment.amount,
    relatedEntityType: args.payment.relatedEntityType,
    relatedEntityId: args.payment.relatedEntityId,
    metadata: {
      ...args.metadata,
      payfastSettlement: args.settlement,
    },
  });

  await db.paymentRecord.update({
    where: { id: args.paymentRecordId },
    data: {
      metadata: {
        ...args.metadata,
        domainEffectsApplied: true,
        domainEffectsAppliedAt: new Date().toISOString(),
      },
    },
  });
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

  const now = new Date();
  const provider =
    options?.provider ??
    payment.provider ??
    (options?.settlement?.settlementSource === "demo" ? DEMO_PAYMENT_PROVIDER : PAYMENT_PROVIDER);
  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};
  const settlement = resolveSettlement(payment, provider, options?.settlement);
  const isDemo = provider === DEMO_PAYMENT_PROVIDER;

  if (payment.status === "SUCCEEDED") {
    // Recovery path: prior run may have marked SUCCEEDED then failed mid-allocation/effects.
    try {
      await runPostSuccessMoneyAndEffects({
        paymentRecordId,
        payment,
        provider,
        settlement:
          payment.settlementAmount != null && Number.isFinite(Number(payment.settlementAmount))
            ? {
                amountGross: Number(payment.amount),
                providerFeeAmount: Number(payment.providerFeeAmount ?? 0),
                settlementAmount: Number(payment.settlementAmount),
                providerPaymentMethod: payment.providerPaymentMethod ?? settlement.providerPaymentMethod,
                providerPaymentMethodLabel: settlement.providerPaymentMethodLabel,
                settlementSource: (payment.settlementSource as PayFastSettlementBreakdown["settlementSource"]) ||
                  settlement.settlementSource,
              }
            : settlement,
        metadata,
        isDemo,
        recovery: true,
      });
    } catch (err) {
      console.error("gateway recovery allocation/effects failed", paymentRecordId, err);
    }
    return { ok: true, already: true, paymentRecordId };
  }

  if (payment.status === "FAILED" || payment.status === "CANCELLED") {
    return { ok: false, error: "Payment is no longer pending.", status: 409 };
  }

  // Conditional claim: only one concurrent completer wins the PENDING → SUCCEEDED race.
  const claimed = await db.paymentRecord.updateMany({
    where: { id: paymentRecordId, status: "PENDING" },
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
    },
  });

  if (claimed.count === 0) {
    const latest = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
    if (latest?.status === "SUCCEEDED") {
      return completeGatewayPayment(paymentRecordId, options);
    }
    return { ok: false, error: "Payment is no longer pending.", status: 409 };
  }

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      metadata: {
        ...metadata,
        ...(isDemo ? { demoCompletedAt: now.toISOString() } : {}),
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
      settlementAmount: settlement.settlementAmount,
      providerFeeAmount: settlement.providerFeeAmount,
    },
    signatureVerified: provider === DEMO_PAYMENT_PROVIDER ? true : Boolean(options?.reference),
  });

  try {
    await runPostSuccessMoneyAndEffects({
      paymentRecordId,
      payment,
      provider,
      settlement,
      metadata,
      isDemo,
      recovery: false,
    });
  } catch (err) {
    // Status is already SUCCEEDED; recovery path on retry re-runs idempotent allocation/effects.
    console.error("gateway allocation/effects failed after SUCCEEDED; will retry on next completion", paymentRecordId, err);
  }

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
