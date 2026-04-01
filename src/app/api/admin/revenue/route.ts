import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorRevenue, getPlatformStats, getViewerSubscriptionRevenue } from "@/lib/revenue";
import { COMPANY_PLAN_CONFIG, CREATOR_LICENSE_CONFIG, normalizeCompanyPlan, normalizeCreatorLicenseType } from "@/lib/pricing";

const PAYMENT_PURPOSES = {
  COMPANY_SUBSCRIPTION: "COMPANY_SUBSCRIPTION",
  COMPANY_SUBSCRIPTION_RENEWAL: "COMPANY_SUBSCRIPTION_RENEWAL",
  CREATOR_YEARLY_LICENSE: "CREATOR_YEARLY_LICENSE",
  CREATOR_CONTENT_UPLOAD: "CREATOR_CONTENT_UPLOAD",
  CREATOR_MUSIC_UPLOAD: "CREATOR_MUSIC_UPLOAD",
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date();

  const viewerSubRevenue = await getViewerSubscriptionRevenue(periodStart, periodEnd);
  const creatorPoolFromSubs = viewerSubRevenue * 0.6;
  const storyTimeFromSubs = viewerSubRevenue * 0.4;

  const transactionFees = await prisma.transaction.aggregate({
    where: { status: "COMPLETED", createdAt: { gte: periodStart, lte: periodEnd } },
    _sum: { feeAmount: true, totalAmount: true },
  });
  const companySubRevenue = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [PAYMENT_PURPOSES.COMPANY_SUBSCRIPTION, PAYMENT_PURPOSES.COMPANY_SUBSCRIPTION_RENEWAL],
      },
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true, metadata: true },
  });
  const standardCount = companySubRevenue.filter((s) => normalizeCompanyPlan((s.metadata as { plan?: string } | null)?.plan) === "STANDARD").length;
  const promotedCount = companySubRevenue.filter((s) => normalizeCompanyPlan((s.metadata as { plan?: string } | null)?.plan) === "FEATURED").length;
  const companySubTotal =
    companySubRevenue.reduce((sum, payment) => sum + payment.amount, 0);
  const yearlyLicensePayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: PAYMENT_PURPOSES.CREATOR_YEARLY_LICENSE,
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true },
  });
  const perUploadPayments = await prisma.paymentRecord.findMany({
    where: {
      status: "SUCCEEDED",
      purpose: {
        in: [PAYMENT_PURPOSES.CREATOR_CONTENT_UPLOAD, PAYMENT_PURPOSES.CREATOR_MUSIC_UPLOAD],
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

  const syncDeals = await prisma.syncDeal.findMany({ select: { amount: true, musicTrack: { select: { creatorId: true } } } });
  const syncByCreator: Record<string, number> = {};
  let totalSyncRevenue = 0;
  for (const d of syncDeals) {
    syncByCreator[d.musicTrack.creatorId] = (syncByCreator[d.musicTrack.creatorId] || 0) + d.amount;
    totalSyncRevenue += d.amount;
  }

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
    })
  );

  const platformStats = await getPlatformStats(periodStart, periodEnd);

  const contentWithWatch = await prisma.content.findMany({
    where: { published: true },
    select: {
      id: true, title: true, type: true,
      creator: { select: { name: true } },
      watchSessions: { where: { startedAt: { gte: periodStart, lte: periodEnd } }, select: { durationSeconds: true } },
    },
  });

  const totalWatchTime = contentWithWatch.reduce((s, c) => s + c.watchSessions.reduce((ss, w) => ss + w.durationSeconds, 0), 0);
  const creatorPool = platformStats.revenuePool * 0.7;

  const contentRevenue = contentWithWatch.map((c) => {
    const wt = c.watchSessions.reduce((s, w) => s + w.durationSeconds, 0);
    const share = totalWatchTime > 0 ? (wt / totalWatchTime) * 100 : 0;
    return {
      id: c.id, title: c.title, type: c.type,
      creatorName: c.creator.name || "Unknown",
      watchTime: wt, share, revenue: (share / 100) * creatorPool,
    };
  }).filter((c) => c.watchTime > 0);

  return NextResponse.json({
    creators: revenueData.sort((a, b) => (b.revenue + b.syncEarnings) - (a.revenue + a.syncEarnings)),
    platform: { ...platformStats, platformCut: platformStats.revenuePool * 0.3, creatorPool: creatorPoolFromSubs || platformStats.revenuePool * 0.7, totalWatchTime: platformStats.totalWatchTime },
    syncDeals: { totalDeals: syncDeals.length, totalSyncRevenue },
    contentRevenue: contentRevenue.sort((a, b) => b.revenue - a.revenue),
    viewerSub: { viewerSubRevenue, creatorPoolFromSubs, storyTimeFromSubs },
    transactionFees: { totalFees: transactionFees._sum.feeAmount ?? 0, totalVolume: transactionFees._sum.totalAmount ?? 0 },
    companySubs: { count: companySubRevenue.length, revenue: companySubTotal },
    distributionLicenses: { yearlyCount, perUploadCount, revenue: distRevenue },
  });
}
