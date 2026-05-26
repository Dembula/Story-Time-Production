import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorCommandCenter } from "@/lib/creator-command-center";
import { formatZar } from "@/lib/format-currency-zar";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "month";

  if (role === "CONTENT_CREATOR" || role === "ADMIN") {
    const cc = await getCreatorCommandCenter(userId, role, { range });
    const pendingReview = await prisma.content.count({
      where: {
        creatorId: userId,
        OR: [{ reviewStatus: "SUBMITTED" }, { reviewStatus: "IN_REVIEW" }],
      },
    });
    const drafts = await prisma.content.count({
      where: { creatorId: userId, reviewStatus: "DRAFT" },
    });
    const published = await prisma.content.count({
      where: { creatorId: userId, published: true },
    });
    const latestPayout = await prisma.payoutRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, amount: true, currency: true },
    });

    return NextResponse.json({
      role: "CONTENT_CREATOR",
      revenueZar: cc.analytics.revenue.amount,
      revenueFormatted: formatZar(cc.analytics.revenue.amount),
      viewsWindow: cc.analytics.revenue.totalViews,
      watchHours: Math.round(cc.analytics.engagement.totalWatchTimeSeconds / 3600),
      viewerGrowth7dPct: cc.overview.viewerGrowth7dPct,
      activeProjects: cc.overview.activeProjects,
      openIncidents: cc.production.openIncidents,
      pendingReview,
      drafts,
      published,
      payoutStatus: latestPayout?.status ?? null,
      payoutAmount: latestPayout?.amount ?? null,
    });
  }

  if (role === "MUSIC_CREATOR") {
    const [tracks, paidDeals, pendingRequests] = await Promise.all([
      prisma.musicTrack.count({ where: { creatorId: userId, published: true } }),
      prisma.syncDeal.count({ where: { musicTrack: { creatorId: userId }, status: "PAID" } }),
      prisma.syncRequest.count({ where: { musicCreatorId: userId, status: "PENDING" } }),
    ]);
    return NextResponse.json({
      role: "MUSIC_CREATOR",
      tracks,
      paidDeals,
      pendingRequests,
    });
  }

  if (role === "FUNDER") {
    const profile = await prisma.funderProfile.findFirst({
      where: { userId },
      select: { id: true, verificationStatus: true },
    });
    const activeDeals = await prisma.investmentDeal.count({
      where: {
        funderUserId: userId,
        pipelineStatus: { notIn: ["REJECTED", "FUNDED"] },
      },
    });
    return NextResponse.json({
      role: "FUNDER",
      verificationStatus: profile?.verificationStatus ?? "PENDING",
      activeDeals,
    });
  }

  return NextResponse.json({ role, message: "Summary not available for this role" });
}
