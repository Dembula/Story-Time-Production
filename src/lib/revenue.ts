import { prisma } from "./prisma";

const VIEWER_SUBSCRIPTION_PURPOSES = ["viewer_subscription", "viewer_subscription_renewal"] as const;

/** Viewer subscription revenue (ZAR) in period from completed gateway payments. */
export async function getViewerSubscriptionRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
  const [gatewayPayments, legacyPayments] = await Promise.all([
    prisma.paymentRecord.aggregate({
      where: {
        status: "SUCCEEDED",
        purpose: { in: [...VIEWER_SUBSCRIPTION_PURPOSES] },
        paidAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: "COMPLETED",
        paidAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  return roundMoney((gatewayPayments._sum.amount ?? 0) + (legacyPayments._sum.amount ?? 0));
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
    getViewerSubscriptionRevenue(periodStart, periodEnd),
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
    getViewerSubscriptionRevenue(periodStart, periodEnd),
  ]);

  return {
    totalUsers,
    totalContent,
    totalWatchTime: totalWatchTime._sum.durationSeconds ?? 0,
    revenuePool: viewerSubRevenue > 0 ? viewerSubRevenue : (totalRevenue?.amount ?? 0),
  };
}
