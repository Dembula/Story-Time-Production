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
import { getCashSettlementAmount, isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT } from "@/lib/payments/config";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { getWalletSnapshot } from "@/lib/payments/wallet";
import { hasCreatorPoolDistribution, getPreviousCalendarMonthRange } from "@/lib/payments/creator-pool-distribution";

function sumCashPayments(
  payments: Array<{
    amount: number;
    settlementAmount?: number | null;
    status?: string | null;
    purpose?: string | null;
    provider?: string | null;
    metadata?: unknown;
    settlementSource?: string | null;
  }>,
) {
  return payments
    .filter((p) => isCashRecognizedPayment({ ...p, status: p.status ?? "SUCCEEDED" }))
    .reduce((sum, p) => sum + getCashSettlementAmount({ ...p, status: "SUCCEEDED" }), 0);
}

export async function fetchAdminRevenueBundle() {
  const { periodStart, periodEnd } = getCalendarMonthToDateRange();

  const viewerSubRevenue = await getViewerSubscriptionRevenue(periodStart, periodEnd);
  const creatorPoolFromSubs = viewerSubRevenue * VIEWER_CREATOR_SPLIT;
  const storyTimeFromSubs = viewerSubRevenue * VIEWER_PLATFORM_SPLIT;

  const treasuryUserId = await getPlatformTreasuryUserId();
  const treasuryWallet = await getWalletSnapshot(treasuryUserId);
  const previousMonth = getPreviousCalendarMonthRange();
  const previousMonthDistributed = await hasCreatorPoolDistribution(previousMonth.periodKey);

  const transactionFees = await aggregateCompletedMarketplaceFees(periodStart, periodEnd);
  const companySubRevenue = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [
          ADMIN_PAYMENT_PURPOSE.COMPANY_SUBSCRIPTION,
          ADMIN_PAYMENT_PURPOSE.COMPANY_SUBSCRIPTION_RENEWAL,
          "company_subscription",
          "company_subscription_renewal",
        ],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
      amount: { gt: 0 },
    },
    select: {
      amount: true,
      settlementAmount: true,
      metadata: true,
      provider: true,
      settlementSource: true,
      status: true,
      purpose: true,
    },
  });
  const companySubTotal = sumCashPayments(companySubRevenue);
  const yearlyLicensePayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [
          ADMIN_PAYMENT_PURPOSE.CREATOR_YEARLY_LICENSE,
          "creator_distribution_license",
          "creator_pipeline_yearly",
          "creator_upload_only_yearly",
          "creator_distribution_yearly",
        ],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
      amount: { gt: 0 },
    },
    select: {
      amount: true,
      settlementAmount: true,
      metadata: true,
      provider: true,
      settlementSource: true,
      status: true,
      purpose: true,
    },
  });
  const perUploadPayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [
          ADMIN_PAYMENT_PURPOSE.CREATOR_CONTENT_UPLOAD,
          ADMIN_PAYMENT_PURPOSE.CREATOR_MUSIC_UPLOAD,
          "creator_film_upload",
          "creator_music_upload",
          "music_track_publish",
        ],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
      amount: { gt: 0 },
    },
    select: {
      amount: true,
      settlementAmount: true,
      metadata: true,
      provider: true,
      settlementSource: true,
      status: true,
      purpose: true,
    },
  });
  const yearlyCash = yearlyLicensePayments.filter((p) => isCashRecognizedPayment(p));
  const perUploadCash = perUploadPayments.filter((p) => isCashRecognizedPayment(p));
  const yearlyCount = yearlyCash.length;
  const perUploadCount = perUploadCash.length;
  const distRevenue = sumCashPayments(yearlyLicensePayments) + sumCashPayments(perUploadPayments);

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
      watchSessions: {
        where: { startedAt: { gte: periodStart, lte: periodEnd }, countsForCreatorRevenue: true },
        select: { durationSeconds: true },
      },
    },
  });

  const totalWatchTime = contentWithWatch.reduce((s, c) => s + c.watchSessions.reduce((ss, w) => ss + w.durationSeconds, 0), 0);
  const creatorPool = creatorPoolFromSubs || platformStats.revenuePool * VIEWER_CREATOR_SPLIT;

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
      platformCut: platformStats.revenuePool * VIEWER_PLATFORM_SPLIT,
      creatorPool: creatorPoolFromSubs || platformStats.revenuePool * VIEWER_CREATOR_SPLIT,
      totalWatchTime: platformStats.totalWatchTime,
    },
    syncDeals: { totalDeals: syncDealCount, totalSyncRevenue },
    contentRevenue: contentRevenue.sort((a, b) => b.revenue - a.revenue),
    viewerSub: { viewerSubRevenue, creatorPoolFromSubs, storyTimeFromSubs },
    treasury: {
      availableBalance: treasuryWallet?.availableBalance ?? 0,
      pendingBalance: treasuryWallet?.pendingBalance ?? 0,
      totalEarnings: treasuryWallet?.totalEarnings ?? 0,
      previousMonthKey: previousMonth.periodKey,
      previousMonthDistributed,
    },
    transactionFees: { totalFees: transactionFees._sum.feeAmount ?? 0, totalVolume: transactionFees._sum.totalAmount ?? 0 },
    companySubs: { count: companySubRevenue.filter((p) => isCashRecognizedPayment(p)).length, revenue: companySubTotal },
    distributionLicenses: { yearlyCount, perUploadCount, revenue: distRevenue },
  };
}

export type AdminRevenueBundle = Awaited<ReturnType<typeof fetchAdminRevenueBundle>>;
