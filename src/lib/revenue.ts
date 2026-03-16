import { prisma } from "./prisma";

/** Viewer subscription revenue (ZAR) in period from completed payments */
export async function getViewerSubscriptionRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
  const result = await prisma.subscriptionPayment.aggregate({
    where: {
      status: "COMPLETED",
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
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
  const creatorPool = viewerSubRevenue > 0 ? viewerSubRevenue * 0.6 : (platformRevenue?.amount ?? 10000);
  const revenue = creatorShare * creatorPool;

  return {
    revenue: Math.round(revenue * 100) / 100,
    watchTime: creatorSeconds,
    share: Math.round(creatorShare * 10000) / 100,
  };
}

export async function getPlatformStats(periodStart: Date, periodEnd: Date) {
  const [totalUsers, totalContent, totalWatchTime, totalRevenue] = await Promise.all([
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
  ]);

  return {
    totalUsers,
    totalContent,
    totalWatchTime: totalWatchTime._sum.durationSeconds ?? 0,
    revenuePool: totalRevenue?.amount ?? 10000,
  };
}
