import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorRevenue } from "@/lib/revenue";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const creators = await prisma.user.findMany({
    where: { role: "CONTENT_CREATOR" },
    select: {
      id: true, name: true, email: true, role: true,
      bio: true, socialLinks: true, education: true, goals: true, previousWork: true, isAfdaStudent: true,
      creatorDistributionLicense: { select: { type: true } },
      _count: { select: { contents: true } },
      contents: {
        select: {
          id: true, title: true, type: true, published: true, reviewStatus: true, year: true, duration: true, category: true,
          _count: { select: { watchSessions: true, ratings: true, comments: true } },
          ratings: { select: { score: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const withRevenue = await Promise.all(
    creators.map(async (c) => {
      const rev = await getCreatorRevenue(c.id, periodStart, now);
      const totalViews = c.contents.reduce((s, x) => s + (x._count?.watchSessions ?? 0), 0);
      const allRatings = c.contents.flatMap((x) => x.ratings);
      const avgRating = allRatings.length > 0 ? allRatings.reduce((s, r) => s + r.score, 0) / allRatings.length : 0;
      const totalComments = c.contents.reduce((s, x) => s + (x._count?.comments ?? 0), 0);
      return { ...c, revenue: rev.revenue, revenueShare: rev.share, watchTime: rev.watchTime, totalViews, avgRating, totalComments };
    })
  );

  return NextResponse.json(withRevenue.sort((a, b) => b.totalViews - a.totalViews));
}
