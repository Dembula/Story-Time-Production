import { prisma } from "./prisma";
import { getPaymentSettlementAmount } from "@/lib/payments/payfast-settlement";

const VIEWER_POOL_PURPOSES = ["viewer_subscription", "viewer_subscription_renewal", "viewer_ppv"] as const;

/** Viewer pool revenue (subscriptions + PPV) in ZAR — net after PayFast fees when recorded. */
export async function getViewerPoolRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
  const [gatewayPayments, legacyPayments] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        status: "SUCCEEDED",
        purpose: { in: [...VIEWER_POOL_PURPOSES] },
        paidAt: { gte: periodStart, lte: periodEnd },
      },
      select: { amount: true, settlementAmount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: "COMPLETED",
        paidAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const gatewayNet = gatewayPayments.reduce(
    (sum, p) => sum + getPaymentSettlementAmount({ amount: p.amount, settlementAmount: p.settlementAmount }),
    0,
  );

  return roundMoney(gatewayNet + (legacyPayments._sum.amount ?? 0));
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
        content: { creatorId },
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: {
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
      where: { startedAt: { gte: periodStart, lte: periodEnd } },
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
