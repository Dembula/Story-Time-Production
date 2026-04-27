import { prisma } from "@/lib/prisma";
import {
  ADMIN_PAYMENT_PURPOSE,
  aggregateCompletedMarketplaceFees,
  aggregateSyncDealsByCreator,
  buildAdminRevenueReportingMeta,
  getCalendarMonthToDateRange,
  getCreatorRevenue,
  getPlatformStats,
  getViewerSubscriptionRevenue,
} from "@/lib/financial-ledger";

export async function fetchAdminRevenueBundle() {
  const { periodStart, periodEnd } = getCalendarMonthToDateRange();

  const viewerSubRevenue = await getViewerSubscriptionRevenue(periodStart, periodEnd);
  const creatorPoolFromSubs = viewerSubRevenue * 0.6;
  const storyTimeFromSubs = viewerSubRevenue * 0.4;

  const transactionFees = await aggregateCompletedMarketplaceFees(periodStart, periodEnd);
  const companySubRevenue = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [ADMIN_PAYMENT_PURPOSE.COMPANY_SUBSCRIPTION, ADMIN_PAYMENT_PURPOSE.COMPANY_SUBSCRIPTION_RENEWAL],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true, metadata: true },
  });
  const companySubTotal = companySubRevenue.reduce((sum, payment) => sum + payment.amount, 0);
  const yearlyLicensePayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: ADMIN_PAYMENT_PURPOSE.CREATOR_YEARLY_LICENSE,
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true },
  });
  const perUploadPayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [ADMIN_PAYMENT_PURPOSE.CREATOR_CONTENT_UPLOAD, ADMIN_PAYMENT_PURPOSE.CREATOR_MUSIC_UPLOAD],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true },
  });
  const yearlyCount = yearlyLicensePayments.length;
  const perUploadCount = perUploadPayments.length;
  const distRevenue =
    yearlyLicensePayments.reduce((sum, payment) => sum + payment.amount, 0) +
    perUploadPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const creators = await prisma.user.findMany({
    where: { OR: [{ role: "CONTENT_CREATOR" }, { role: "MUSIC_CREATOR" }] },
    select: { id: true, name: true, email: true, role: true, _count: { select: { contents: true, musicTracks: true } } },
  });

  const { syncByCreator, totalSyncRevenue, totalDeals: syncDealCount } = await aggregateSyncDealsByCreator({
    start: periodStart,
    end: periodEnd,
  });

  const revenueData = await Promise.all(
    creators.map(async (c) => {
      const rev = await getCreatorRevenue(c.id, periodStart, periodEnd);
      return {
        ...c,
        ...rev,
        contentCount: c._count.contents,
        trackCount: c._count.musicTracks,
        syncEarnings: syncByCreator[c.id] || 0,
      };
    }),
  );

  const platformStats = await getPlatformStats(periodStart, periodEnd);

  const contentWithWatch = await prisma.content.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      type: true,
      creator: { select: { name: true } },
      watchSessions: { where: { startedAt: { gte: periodStart, lte: periodEnd } }, select: { durationSeconds: true } },
    },
  });

  const totalWatchTime = contentWithWatch.reduce((s, c) => s + c.watchSessions.reduce((ss, w) => ss + w.durationSeconds, 0), 0);
  const creatorPool = platformStats.revenuePool * 0.7;

  const contentRevenue = contentWithWatch
    .map((c) => {
      const wt = c.watchSessions.reduce((s, w) => s + w.durationSeconds, 0);
      const share = totalWatchTime > 0 ? (wt / totalWatchTime) * 100 : 0;
      return {
        id: c.id,
        title: c.title,
        type: c.type,
        creatorName: c.creator.name || "Unknown",
        watchTime: wt,
        share,
        revenue: (share / 100) * creatorPool,
      };
    })
    .filter((c) => c.watchTime > 0);

  const reporting = buildAdminRevenueReportingMeta(periodStart, periodEnd);

  return {
    periodStart,
    periodEnd,
    reporting,
    creators: revenueData.sort((a, b) => b.revenue + b.syncEarnings - (a.revenue + a.syncEarnings)),
    platform: {
      ...platformStats,
      platformCut: platformStats.revenuePool * 0.3,
      creatorPool: creatorPoolFromSubs || platformStats.revenuePool * 0.7,
      totalWatchTime: platformStats.totalWatchTime,
    },
    syncDeals: { totalDeals: syncDealCount, totalSyncRevenue },
    contentRevenue: contentRevenue.sort((a, b) => b.revenue - a.revenue),
    viewerSub: { viewerSubRevenue, creatorPoolFromSubs, storyTimeFromSubs },
    transactionFees: { totalFees: transactionFees._sum.feeAmount ?? 0, totalVolume: transactionFees._sum.totalAmount ?? 0 },
    companySubs: { count: companySubRevenue.length, revenue: companySubTotal },
    distributionLicenses: { yearlyCount, perUploadCount, revenue: distRevenue },
  };
}

export type AdminRevenueBundle = Awaited<ReturnType<typeof fetchAdminRevenueBundle>>;
