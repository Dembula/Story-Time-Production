import "server-only";

import { isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import {
  computeFundsClearDueAt,
  markPaymentFundsCleared,
  scheduleFundsClearForPayment,
} from "@/lib/payments/funds-clearing";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Schedule Apple IAP clear clock (45d). Ledger books only after clear / early manual clear. */
export async function bookAppleIapLedgerIfCash(payment: {
  id: string;
  amount: number;
  settlementAmount?: number;
  purpose: string;
  relatedEntityType: string;
  relatedEntityId: string;
  environment: string;
}) {
  const settlementAmount =
    payment.settlementAmount != null && Number.isFinite(payment.settlementAmount)
      ? payment.settlementAmount
      : payment.amount;

  const cashRecognized = isCashRecognizedPayment({
    status: "SUCCEEDED",
    amount: payment.amount,
    settlementAmount,
    provider: "APPLE",
    settlementSource: "apple_estimated",
    purpose: payment.purpose,
    metadata: { environment: payment.environment, source: "ios_app" },
  });

  if (!cashRecognized || !(settlementAmount > 0)) return;

  const { ensureCreatorRevenueTrackingLive, getRevenueConnector } = await import(
    "@/lib/finance/revenue-connector"
  );
  await ensureCreatorRevenueTrackingLive().catch(() => {});
  const connector = await getRevenueConnector();

  const row = await db.paymentRecord.findUnique({
    where: { id: payment.id },
    select: { paidAt: true, fundsClearDueAt: true, fundsClearedAt: true },
  });
  const paidAt = row?.paidAt ? new Date(row.paidAt) : new Date();

  let dueAt = row?.fundsClearDueAt != null ? new Date(row.fundsClearDueAt) : null;
  if (!row?.fundsClearDueAt && !row?.fundsClearedAt) {
    const scheduled = await scheduleFundsClearForPayment({
      paymentRecordId: payment.id,
      paidAt,
      provider: "APPLE",
      trackingStartedAt: connector.trackingStartedAt,
    });
    if (scheduled.skipped || !scheduled.fundsClearDueAt) return;
    dueAt = scheduled.fundsClearDueAt;
  }

  const due = dueAt ?? computeFundsClearDueAt(paidAt, "APPLE");
  if (row?.fundsClearedAt || due.getTime() <= Date.now()) {
    await markPaymentFundsCleared({
      paymentRecordId: payment.id,
      mode: "auto",
      now: new Date(),
    }).catch((err: unknown) => {
      console.error("apple_iap funds clear/allocate failed", payment.id, err);
    });
  }
}
