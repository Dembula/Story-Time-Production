import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorRevenue } from "@/lib/revenue";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let creatorId =
    role === "ADMIN"
      ? request.nextUrl.searchParams.get("creatorId") || undefined
      : session?.user?.id;
  if (role === "ADMIN" && !creatorId) {
    const first = await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" }, select: { id: true } });
    creatorId = first?.id ?? session?.user?.id;
  }

  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date();

  const [
    totalViews,
    uniqueWatchers,
    avgWatchTime,
    revenue,
    contentCount,
    totalComments,
    totalRatings,
  ] = await Promise.all([
    prisma.watchSession.count({
      where: { content: { creatorId } },
    }),
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: { content: { creatorId } },
    }).then((r) => r.length),
    prisma.watchSession.aggregate({
      where: { content: { creatorId } },
      _avg: { durationSeconds: true },
      _sum: { durationSeconds: true },
    }),
    getCreatorRevenue(creatorId, periodStart, periodEnd),
    prisma.content.count({ where: { creatorId } }),
    prisma.comment.count({ where: { content: { creatorId } } }),
    prisma.rating.count({ where: { content: { creatorId } } }),
  ]);

  return NextResponse.json({
    totalViews,
    uniqueWatchers,
    averageWatchTime: avgWatchTime._avg.durationSeconds ?? 0,
    totalWatchTime: avgWatchTime._sum.durationSeconds ?? 0,
    revenue: revenue.revenue,
    revenueShare: revenue.share,
    contentCount,
    totalComments,
    totalRatings,
    periodStart,
    periodEnd,
  });
}
