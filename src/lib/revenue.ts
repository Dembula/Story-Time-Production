import { prisma } from "./prisma";
import { getCashSettlementAmount, isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { VIEWER_POOL_PAYMENT_PURPOSES } from "@/lib/payments/viewer-pool-purposes";
import { revenueEligibleWatchSessionWhere } from "@/lib/revenue-eligible-watch";

/**
 * Viewer pool revenue (subscriptions + PPV) in ZAR — net after PayFast fees.
 * Uses PaymentRecord only (SubscriptionPayment is a legacy mirror and must not double-count).
 * Excludes promo-covered and demo completions.
 */
export async function getViewerPoolRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
  const gatewayPayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: { in: [...VIEWER_POOL_PAYMENT_PURPOSES] },
      paidAt: { gte: periodStart, lte: periodEnd },
      amount: { gt: 0 },
    },
    select: {
      amount: true,
      settlementAmount: true,
      status: true,
      purpose: true,
      metadata: true,
      provider: true,
      settlementSource: true,
    },
  });

  const gatewayNet = gatewayPayments
    .filter((p) => isCashRecognizedPayment(p))
    .reduce((sum, p) => sum + getCashSettlementAmount(p), 0);

  return roundMoney(gatewayNet);
}

/** @deprecated Use getViewerPoolRevenue — includes subscriptions and PPV. */
export async function getViewerSubscriptionRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
  return getViewerPoolRevenue(periodStart, periodEnd);
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** 60% of viewer sub revenue goes to creators, split by view share. 40% retained by Story Time. */
export async function getCreatorRevenue(
  creatorId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ revenue: number; watchTime: number; share: number }> {
  const [creatorWatchTime, totalPlatformWatchTime, platformRevenue, viewerSubRevenue] = await Promise.all([
    prisma.watchSession.aggregate({
      where: {
        ...revenueEligibleWatchSessionWhere,
        content: { creatorId },
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: {
        ...revenueEligibleWatchSessionWhere,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.platformRevenue.findFirst({
      where: {
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
      },
    }),
    getViewerPoolRevenue(periodStart, periodEnd),
  ]);

  const creatorSeconds = creatorWatchTime._sum.durationSeconds ?? 0;
  const totalSeconds = totalPlatformWatchTime._sum.durationSeconds ?? 1;
  const creatorShare = totalSeconds > 0 ? creatorSeconds / totalSeconds : 0;
  const poolBase =
    viewerSubRevenue > 0 ? viewerSubRevenue : (platformRevenue?.amount ?? 0);
  const creatorPool = poolBase * 0.6;
  const revenue = creatorShare * creatorPool;

  return {
    revenue: Math.round(revenue * 100) / 100,
    watchTime: creatorSeconds,
    share: Math.round(creatorShare * 10000) / 100,
  };
}

export async function getPlatformStats(periodStart: Date, periodEnd: Date) {
  const [totalUsers, totalContent, totalWatchTime, totalRevenue, viewerSubRevenue] = await Promise.all([
    prisma.user.count(),
    prisma.content.count({ where: { published: true } }),
    prisma.watchSession.aggregate({
      where: { ...revenueEligibleWatchSessionWhere, startedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { durationSeconds: true },
    }),
    prisma.platformRevenue.findFirst({
      where: {
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
      },
    }),
    getViewerPoolRevenue(periodStart, periodEnd),
  ]);

  return {
    totalUsers,
    totalContent,
    totalWatchTime: totalWatchTime._sum.durationSeconds ?? 0,
    revenuePool: viewerSubRevenue > 0 ? viewerSubRevenue : (totalRevenue?.amount ?? 0),
  };
}
