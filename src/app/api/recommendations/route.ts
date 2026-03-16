import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return NextResponse.json([]);
  }

  let profileAge: number | null = null;
  let viewerProfileId: string | null = null;
  const cookieStore = await cookies();
  const profileId = cookieStore.get("st_viewer_profile")?.value;
  if (profileId) {
    const profile = await prisma.viewerProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, age: true },
    });
    if (profile) {
      profileAge = profile.age;
      viewerProfileId = profile.id;
    }
  }

  const watchWhere: { userId: string; viewerProfileId?: string | null } = { userId };
  if (viewerProfileId) watchWhere.viewerProfileId = viewerProfileId;

  const watchedContent = await prisma.watchSession.findMany({
    where: watchWhere,
    include: {
      content: {
        select: { category: true, creatorId: true, type: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const categories = [...new Set(watchedContent.map((w) => w.content.category).filter(Boolean))];
  const creators = [...new Set(watchedContent.map((w) => w.content.creatorId))];
  const types = [...new Set(watchedContent.map((w) => w.content.type))];
  const watchedIds = [...new Set(watchedContent.map((w) => w.contentId))];

  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};

  if (categories.length === 0 && creators.length === 0) {
    const popular = await prisma.content.findMany({
      where: { published: true, ...ageFilter },
      include: { _count: { select: { ratings: true } } },
      take: 12,
    });
    const withRatings = await Promise.all(
      popular.map(async (c) => {
        const avg = await prisma.rating.aggregate({
          where: { contentId: c.id },
          _avg: { score: true },
        });
        return { ...c, avgRating: avg._avg.score ?? 0 };
      })
    );
    const sorted = withRatings.sort((a, b) => (b.avgRating * 2 + (b._count?.ratings ?? 0) * 0.1) - (a.avgRating * 2 + (a._count?.ratings ?? 0) * 0.1));
    return NextResponse.json(sorted.slice(0, 12));
  }

  const orConditions = [
    ...(categories.length > 0 ? categories.map((c) => ({ category: c })) : []),
    ...(creators.length > 0 ? creators.map((c) => ({ creatorId: c })) : []),
    ...(types.length > 0 ? types.map((t) => ({ type: t })) : []),
  ];

  const recommendations = await prisma.content.findMany({
    where: {
      published: true,
      ...ageFilter,
      id: { notIn: watchedIds },
      ...(orConditions.length > 0 ? { OR: orConditions } : {}),
    },
    include: {
      _count: { select: { ratings: true } },
    },
    take: 24,
  });

  const withScores = await Promise.all(
    recommendations.map(async (c) => {
      const avg = await prisma.rating.aggregate({
        where: { contentId: c.id },
        _avg: { score: true },
      });
      return { ...c, avgRating: avg._avg.score ?? 0 };
    })
  );

  const scored = withScores
    .map((c) => {
      let score = c.avgRating * 2 + (c._count?.ratings ?? 0) * 0.1;
      if (categories.includes(c.category)) score += 3;
      if (creators.includes(c.creatorId)) score += 2;
      if (types.includes(c.type)) score += 1;
      return { ...c, recScore: score };
    })
    .sort((a, b) => b.recScore - a.recScore);

  return NextResponse.json(scored.slice(0, 12));
}
