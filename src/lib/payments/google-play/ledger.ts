import "server-only";

import { isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import {
  computeFundsClearDueAt,
  markPaymentFundsCleared,
  scheduleFundsClearForPayment,
} from "@/lib/payments/funds-clearing";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Schedule Google Play clear clock (15d). Ledger books only after clear / early manual clear. */
export async function bookGooglePlayLedgerIfCash(payment: {
  id: string;
  amount: number;
  settlementAmount?: number;
  purpose: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** When true, clear immediately (console remittance already received). */
  clearImmediately?: boolean;
}) {
  const settlementAmount =
    payment.settlementAmount != null && Number.isFinite(payment.settlementAmount)
      ? payment.settlementAmount
      : payment.amount;

  const cashRecognized = isCashRecognizedPayment({
    status: "SUCCEEDED",
    amount: payment.amount,
    settlementAmount,
    provider: "GOOGLE",
    settlementSource: payment.clearImmediately ? "google_play_console" : "google_estimated",
    purpose: payment.purpose,
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

  if (payment.clearImmediately) {
    await markPaymentFundsCleared({
      paymentRecordId: payment.id,
      mode: "manual",
      now: new Date(),
    }).catch((err: unknown) => {
      console.error("google_play immediate clear failed", payment.id, err);
    });
    return;
  }

  let dueAt = row?.fundsClearDueAt != null ? new Date(row.fundsClearDueAt) : null;
  if (!row?.fundsClearDueAt && !row?.fundsClearedAt) {
    const scheduled = await scheduleFundsClearForPayment({
      paymentRecordId: payment.id,
      paidAt,
      provider: "GOOGLE",
      trackingStartedAt: connector.trackingStartedAt,
    });
    if (scheduled.skipped || !scheduled.fundsClearDueAt) return;
    dueAt = scheduled.fundsClearDueAt;
  }

  const due = dueAt ?? computeFundsClearDueAt(paidAt, "GOOGLE");
  if (row?.fundsClearedAt || due.getTime() <= Date.now()) {
    await markPaymentFundsCleared({
      paymentRecordId: payment.id,
      mode: "auto",
      now: new Date(),
    }).catch((err: unknown) => {
      console.error("google_play funds clear/allocate failed", payment.id, err);
    });
  }
}
