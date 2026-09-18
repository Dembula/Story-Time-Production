import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getCashSettlementAmount,
  isCashRecognizedPayment,
} from "@/lib/payments/cash-recognition";
import { isFundsCleared } from "@/lib/payments/funds-clearing-policy";
import { getRevenueConnector } from "@/lib/finance/revenue-connector";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";

export type RevenueEligibilityPayment = {
  amount?: number | null;
  settlementAmount?: number | null;
  status?: string | null;
  purpose?: string | null;
  provider?: string | null;
  settlementSource?: string | null;
  metadata?: unknown;
  paidAt?: Date | string | null;
  fundsClearedAt?: Date | string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

/**
 * Start of "today" in Africa/Johannesburg as a UTC Date (midnight SAST = 22:00 previous UTC in winter,
 * 21:00 in summer — we use Intl to avoid hard-coding offset).
 */
export function startOfDayInJohannesburg(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  // Construct as SAST midnight via explicit offset +02:00 (SAST has no DST).
  return new Date(`${y}-${m}-${d}T00:00:00+02:00`);
}

/**
 * Whether this cash payment may count toward creator-pool / cleared finance reporting.
 * Rules:
 * - Must be cash-recognized and funds-cleared
 * - Must fall on/after trackingStartedAt (when tracking is on)
 * - Grandfathered viewer subscriptions (created before tracking start) only count on renewal
 */
export async function isClearedCreatorPoolEligiblePayment(
  payment: RevenueEligibilityPayment,
  options?: { trackingStartedAt?: Date | null; trackingEnabled?: boolean },
): Promise<boolean> {
  if (!isCashRecognizedPayment(payment)) return false;
  if (!isFundsCleared(payment)) return false;

  const connector = options?.trackingStartedAt != null || options?.trackingEnabled != null
    ? {
        creatorRevenueTrackingEnabled: options.trackingEnabled ?? true,
        trackingStartedAt: options.trackingStartedAt ?? null,
      }
    : await getRevenueConnector();

  if (!connector.creatorRevenueTrackingEnabled) return false;
  const startedAt = connector.trackingStartedAt
    ? new Date(connector.trackingStartedAt)
    : null;
  if (!startedAt) return false;

  const paidAt = payment.paidAt ? new Date(payment.paidAt) : null;
  if (!paidAt || Number.isNaN(paidAt.getTime())) return false;
  if (paidAt.getTime() < startedAt.getTime()) return false;

  if (!isViewerPoolPaymentPurpose(payment.purpose ?? "")) {
    // Non-viewer-pool cash still shows in finance cleared totals, but this helper is pool-focused.
    return true;
  }

  if (
    payment.relatedEntityType === "ViewerSubscription" &&
    payment.relatedEntityId
  ) {
    const sub = await prisma.viewerSubscription.findUnique({
      where: { id: payment.relatedEntityId },
      select: { createdAt: true },
    });
    if (sub && sub.createdAt.getTime() < startedAt.getTime()) {
      const purpose = String(payment.purpose ?? "").toLowerCase();
      // Existing active subscribers: only their next renewal (repay) counts.
      return purpose.includes("renewal");
    }
  }

  return true;
}

/** Cleared cash recognized payments eligible for finance hub “available revenue” totals. */
export function isClearedCashForFinanceReporting(payment: RevenueEligibilityPayment): boolean {
  return isCashRecognizedPayment(payment) && isFundsCleared(payment);
}

export async function sumClearedViewerPoolRevenue(
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const connector = await getRevenueConnector();
  if (!connector.creatorRevenueTrackingEnabled || !connector.trackingStartedAt) {
    return 0;
  }

  const { VIEWER_POOL_PAYMENT_PURPOSES } = await import("@/lib/payments/viewer-pool-purposes");
  const payments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: { in: [...VIEWER_POOL_PAYMENT_PURPOSES] },
      paidAt: { gte: periodStart, lte: periodEnd },
      fundsClearedAt: { not: null },
      amount: { gt: 0 },
    },
    select: {
      id: true,
      amount: true,
      settlementAmount: true,
      status: true,
      purpose: true,
      provider: true,
      settlementSource: true,
      metadata: true,
      paidAt: true,
      fundsClearedAt: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  let sum = 0;
  for (const p of payments) {
    if (
      await isClearedCreatorPoolEligiblePayment(p, {
        trackingEnabled: true,
        trackingStartedAt: new Date(connector.trackingStartedAt),
      })
    ) {
      sum += getCashSettlementAmount(p);
    }
  }
  return Math.round((sum + Number.EPSILON) * 100) / 100;
}
