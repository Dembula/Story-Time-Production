import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorRevenue, getViewerSubscriptionRevenue } from "@/lib/revenue";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const creatorId = role === "ADMIN" ? request.nextUrl.searchParams.get("creatorId") || undefined : session?.user?.id;
  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const [revenue, watchSessions, totalViews, banking, payouts, viewerSubRevenue] = await Promise.all([
    getCreatorRevenue(creatorId, periodStart, periodEnd),
    prisma.watchSession.findMany({
      where: { content: { creatorId }, startedAt: { gte: periodStart, lte: periodEnd } },
      select: { durationSeconds: true, contentId: true },
    }),
    prisma.watchSession.count({
      where: { content: { creatorId }, startedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.creatorBanking.findUnique({ where: { userId: creatorId } }),
    prisma.creatorPayout.findMany({
      where: { creatorId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getViewerSubscriptionRevenue(periodStart, periodEnd),
  ]);

  const creatorPool = viewerSubRevenue * 0.6;
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
    viewerSubRevenue,
    banking: banking ? { bankName: banking.bankName, accountNumberLast4: banking.accountNumber?.slice(-4) ?? "****", accountType: banking.accountType, verified: !!banking.verifiedAt } : null,
    payouts,
  });
}
