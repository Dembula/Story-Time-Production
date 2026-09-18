import "server-only";

import { prisma } from "@/lib/prisma";
import { isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { allocateGatewayPaymentLedger } from "@/lib/payments/gateway-allocation";
import { getPaymentSettlementAmount } from "@/lib/payments/payfast-settlement";
import {
  computeFundsClearDueAt,
  type FundsClearMode,
} from "@/lib/payments/funds-clearing-policy";

export {
  APPLE_FUNDS_CLEAR_DAYS,
  PAYFAST_FUNDS_CLEAR_DAYS,
  computeFundsClearDueAt,
  describeFundsClearStatus,
  fundsClearDelayDaysForProvider,
  isFundsCleared,
  type FundsClearMode,
} from "@/lib/payments/funds-clearing-policy";

const db = prisma as any;

/** Stamp clear-due when a live cash payment succeeds (before ledger allocation). */
export async function scheduleFundsClearForPayment(args: {
  paymentRecordId: string;
  paidAt: Date;
  provider: string;
}): Promise<{ fundsClearDueAt: Date }> {
  const fundsClearDueAt = computeFundsClearDueAt(args.paidAt, args.provider);
  await db.paymentRecord.updateMany({
    where: {
      id: args.paymentRecordId,
      fundsClearedAt: null,
    },
    data: {
      fundsClearDueAt,
    },
  });
  return { fundsClearDueAt };
}

async function allocateLedgerAfterClear(payment: {
  id: string;
  amount: number;
  settlementAmount: number | null;
  providerFeeAmount: number | null;
  purpose: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  ledgerAllocatedAt: Date | null;
}) {
  if (payment.ledgerAllocatedAt) return { allocated: false, already: true as const };

  const settlementAmount = getPaymentSettlementAmount({
    amount: payment.amount,
    settlementAmount: payment.settlementAmount,
  });
  if (!(settlementAmount > 0)) {
    await db.paymentRecord.update({
      where: { id: payment.id },
      data: { ledgerAllocatedAt: new Date() },
    });
    return { allocated: false, already: false as const };
  }

  await allocateGatewayPaymentLedger({
    id: payment.id,
    amount: payment.amount,
    settlementAmount,
    providerFeeAmount: payment.providerFeeAmount ?? undefined,
    purpose: payment.purpose,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  });

  await db.paymentRecord.update({
    where: { id: payment.id },
    data: { ledgerAllocatedAt: new Date() },
  });
  return { allocated: true, already: false as const };
}

/**
 * Mark funds cleared (manual early clear or auto clock) and book treasury ledger once.
 */
export async function markPaymentFundsCleared(args: {
  paymentRecordId: string;
  mode: FundsClearMode;
  clearedByUserId?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; already?: boolean; allocated: boolean }
  | { ok: false; error: string; status: number }
> {
  const payment = await db.paymentRecord.findUnique({
    where: { id: args.paymentRecordId },
  });
  if (!payment) return { ok: false, error: "Payment not found.", status: 404 };
  if (String(payment.status).toUpperCase() !== "SUCCEEDED") {
    return { ok: false, error: "Only succeeded payments can be cleared.", status: 409 };
  }
  if (!isCashRecognizedPayment(payment)) {
    return { ok: false, error: "Payment is not cash-recognized (demo/promo excluded).", status: 400 };
  }

  const now = args.now ?? new Date();

  if (payment.fundsClearedAt) {
    const alloc = await allocateLedgerAfterClear(payment);
    return { ok: true, already: true, allocated: alloc.allocated || alloc.already };
  }

  await db.paymentRecord.update({
    where: { id: payment.id },
    data: {
      fundsClearedAt: now,
      fundsClearedMode: args.mode,
      fundsClearedByUserId: args.mode === "manual" ? args.clearedByUserId ?? null : null,
      fundsClearDueAt: payment.fundsClearDueAt ?? computeFundsClearDueAt(payment.paidAt ?? now, payment.provider),
    },
  });

  const refreshed = await db.paymentRecord.findUnique({ where: { id: payment.id } });
  const alloc = await allocateLedgerAfterClear(refreshed);
  return { ok: true, allocated: alloc.allocated };
}

/** Auto-clear payments whose clear-due clock has elapsed. */
export async function processDueFundsClearing(now = new Date()): Promise<{
  scanned: number;
  cleared: number;
  allocated: number;
  errors: number;
  backfilledDue: number;
}> {
  const { ensureCreatorRevenueTrackingLive, getRevenueConnector } = await import(
    "@/lib/finance/revenue-connector"
  );
  await ensureCreatorRevenueTrackingLive().catch(() => {});
  const connector = await getRevenueConnector();
  const trackingStart = connector.trackingStartedAt
    ? new Date(connector.trackingStartedAt)
    : null;

  // Backfill clear-due only for payments on/after tracking start (never pull pre-cutoff cash into the pool).
  const missingDue = await db.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      fundsClearedAt: null,
      fundsClearDueAt: null,
      amount: { gt: 0 },
      paidAt: trackingStart ? { gte: trackingStart } : { not: null },
    },
    select: { id: true, paidAt: true, provider: true, settlementSource: true, metadata: true },
    take: 300,
    orderBy: { paidAt: "asc" },
  });

  let backfilledDue = 0;
  for (const row of missingDue) {
    if (!isCashRecognizedPayment(row)) continue;
    if (!row.paidAt) continue;
    await scheduleFundsClearForPayment({
      paymentRecordId: row.id,
      paidAt: new Date(row.paidAt),
      provider: row.provider || "PAYFAST",
    });
    backfilledDue += 1;
  }

  const due = await db.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      fundsClearedAt: null,
      fundsClearDueAt: { lte: now },
      amount: { gt: 0 },
      ...(trackingStart ? { paidAt: { gte: trackingStart } } : {}),
    },
    select: { id: true },
    take: 200,
    orderBy: { fundsClearDueAt: "asc" },
  });

  let cleared = 0;
  let allocated = 0;
  let errors = 0;

  for (const row of due) {
    try {
      const result = await markPaymentFundsCleared({
        paymentRecordId: row.id,
        mode: "auto",
        now,
      });
      if (result.ok) {
        if (!result.already) cleared += 1;
        if (result.allocated) allocated += 1;
      }
    } catch (err) {
      errors += 1;
      console.error("[funds-clearing] auto clear failed", row.id, err);
    }
  }

  return { scanned: due.length, cleared, allocated, errors, backfilledDue };
}
