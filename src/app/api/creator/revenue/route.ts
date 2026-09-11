import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorRevenue, getViewerSubscriptionRevenue } from "@/lib/financial-ledger";
import { VIEWER_CREATOR_SPLIT } from "@/lib/payments/config";
import { formatRevenuePeriodKey } from "@/lib/payments/creator-pool-distribution";
import { getWalletSnapshot, ensureWalletForUser } from "@/lib/payments/wallet";
import { isCreatorRevenueTrackingEnabled } from "@/lib/finance/revenue-connector";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creatorId = role === "ADMIN" ? request.nextUrl.searchParams.get("creatorId") || undefined : session?.user?.id;
  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trackingEnabled = await isCreatorRevenueTrackingEnabled();
  // Admins inspecting a creator while paused still see zeros on the creator-facing shape.
  if (!trackingEnabled && role !== "ADMIN") {
    const banking = await prisma.creatorBanking.findUnique({ where: { userId: creatorId } });
    return NextResponse.json({
      revenue: 0,
      watchTime: 0,
      share: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
      totalViews: 0,
      streamCount: 0,
      perViewRand: 0,
      perStreamRand: 0,
      creatorPool: 0,
      viewerSubRevenue: 0,
      walletAvailable: 0,
      walletTotalEarnings: 0,
      distributedToWallet: 0,
      projectedRevenue: 0,
      banking: banking
        ? {
            bankName: banking.bankName,
            accountNumberLast4: banking.accountNumber?.slice(-4) ?? "****",
            accountType: banking.accountType,
            verified: !!banking.verifiedAt,
          }
        : null,
      payouts: [],
      revenueTrackingPaused: true,
    });
  }

  const period = request.nextUrl.searchParams.get("period") || "month";
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    periodStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
    periodEnd = new Date();
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date();
  }

  const [revenue, watchSessions, totalViews, banking, payouts, viewerSubRevenue, wallet] = await Promise.all([
    getCreatorRevenue(creatorId, periodStart, periodEnd),
    prisma.watchSession.findMany({
      where: { content: { creatorId }, startedAt: { gte: periodStart, lte: periodEnd } },
      select: { durationSeconds: true, contentId: true },
    }),
    prisma.watchSession.count({
      where: { content: { creatorId }, startedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.creatorBanking.findUnique({ where: { userId: creatorId } }),
    trackingEnabled
      ? prisma.creatorPayout.findMany({
          where: { creatorId },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    getViewerSubscriptionRevenue(periodStart, periodEnd),
    ensureWalletForUser(creatorId).then(() => getWalletSnapshot(creatorId)),
  ]);

  const creatorPool = trackingEnabled ? viewerSubRevenue * VIEWER_CREATOR_SPLIT : 0;
  const periodKey = formatRevenuePeriodKey(periodStart);
  const distributedToWallet = payouts
    .filter((p) => p.bankReference?.startsWith("pool:") && p.period === periodKey)
    .reduce((sum, p) => sum + p.amount, 0);
  const perViewRand = totalViews > 0 ? revenue.revenue / totalViews : 0;
  const perStreamRand = watchSessions.length > 0 ? revenue.revenue / watchSessions.length : 0;

  return NextResponse.json({
    revenue: revenue.revenue,
    watchTime: revenue.watchTime,
    share: revenue.share,
    periodStart,
    periodEnd,
    totalViews,
    streamCount: watchSessions.length,
    perViewRand: Math.round(perViewRand * 100) / 100,
    perStreamRand: Math.round(perStreamRand * 100) / 100,
    creatorPool,
    viewerSubRevenue: trackingEnabled ? viewerSubRevenue : 0,
    walletAvailable: trackingEnabled ? (wallet?.availableBalance ?? 0) : 0,
    walletTotalEarnings: trackingEnabled ? (wallet?.totalEarnings ?? 0) : 0,
    distributedToWallet: trackingEnabled ? distributedToWallet : 0,
    projectedRevenue: revenue.revenue,
    banking: banking
      ? {
          bankName: banking.bankName,
          accountNumberLast4: banking.accountNumber?.slice(-4) ?? "****",
          accountType: banking.accountType,
          verified: !!banking.verifiedAt,
        }
      : null,
    payouts: trackingEnabled ? payouts : [],
    revenueTrackingPaused: !trackingEnabled,
  });
}
