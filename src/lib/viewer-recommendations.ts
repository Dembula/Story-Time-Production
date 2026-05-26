import { prisma } from "@/lib/prisma";

const LOOKBACK_DAYS = 30;

type RecCandidate = {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  videoUrl: string | null;
  category: string | null;
  type: string;
  creatorId: string;
  _count: { ratings: number };
  avgRating: number;
  recScore: number;
};

export async function getViewerRecommendations(options: {
  userId: string;
  viewerProfileId: string | null;
  profileAge: number | null;
  limit?: number;
}): Promise<RecCandidate[]> {
  const { userId, viewerProfileId, profileAge } = options;
  const limit = options.limit ?? 12;
  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const watchWhere: { userId: string; viewerProfileId?: string } = { userId };
  if (viewerProfileId) watchWhere.viewerProfileId = viewerProfileId;

  const [watchedSessions, watchProgress, trendingAgg] = await Promise.all([
    prisma.watchSession.findMany({
      where: { ...watchWhere, startedAt: { gte: since } },
      include: { content: { select: { category: true, creatorId: true, type: true } } },
      orderBy: { startedAt: "desc" },
      take: 40,
    }),
    viewerProfileId
      ? prisma.watchProgress.findMany({
          where: { viewerProfileId },
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: { content: { select: { category: true, creatorId: true, type: true } } },
        })
      : Promise.resolve([]),
    prisma.watchSession.groupBy({
      by: ["contentId"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { contentId: "desc" } },
      take: 40,
    }),
  ]);

  const watchedIds = new Set<string>([
    ...watchedSessions.map((w) => w.contentId),
    ...watchProgress.map((w) => w.contentId),
  ]);

  const categories = new Set<string>();
  const creators = new Set<string>();
  const types = new Set<string>();
  for (const w of watchedSessions) {
    if (w.content.category) categories.add(w.content.category);
    creators.add(w.content.creatorId);
    types.add(w.content.type);
  }
  for (const w of watchProgress) {
    if (w.content.category) categories.add(w.content.category);
    creators.add(w.content.creatorId);
    types.add(w.content.type);
  }

  const trendingMap = new Map(trendingAgg.map((t) => [t.contentId, t._count._all]));

  // Collaborative: what did similar viewers watch?
  const coWatchScores = new Map<string, number>();
  if (watchedIds.size > 0) {
    const peerSessions = await prisma.watchSession.findMany({
      where: {
        contentId: { in: [...watchedIds] },
        userId: { not: userId },
        startedAt: { gte: since },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 50,
    });
    const peerUserIds = peerSessions.map((p) => p.userId);
    if (peerUserIds.length > 0) {
      const peerWatches = await prisma.watchSession.groupBy({
        by: ["contentId"],
        where: {
          userId: { in: peerUserIds },
          contentId: { notIn: [...watchedIds] },
          startedAt: { gte: since },
        },
        _count: { _all: true },
      });
      for (const row of peerWatches) {
        coWatchScores.set(row.contentId, row._count._all);
      }
    }
  }

  const orConditions = [
    ...(categories.size > 0 ? [...categories].map((c) => ({ category: c })) : []),
    ...(creators.size > 0 ? [...creators].map((c) => ({ creatorId: c })) : []),
    ...(types.size > 0 ? [...types].map((t) => ({ type: t })) : []),
  ];

  const pool = await prisma.content.findMany({
    where: {
      published: true,
      ...ageFilter,
      id: { notIn: [...watchedIds] },
      ...(orConditions.length > 0 ? { OR: orConditions } : {}),
    },
    include: { _count: { select: { ratings: true } } },
    take: 48,
  });

  if (pool.length === 0 && watchedIds.size > 0) {
    const fallback = await prisma.content.findMany({
      where: { published: true, ...ageFilter, id: { notIn: [...watchedIds] } },
      include: { _count: { select: { ratings: true } } },
      take: 48,
    });
    pool.push(...fallback);
  }

  if (pool.length === 0) {
    const cold = await prisma.content.findMany({
      where: { published: true, ...ageFilter },
      include: { _count: { select: { ratings: true } } },
      take: 24,
    });
    pool.push(...cold);
  }

  const ratingGroups = await prisma.rating.groupBy({
    by: ["contentId"],
    where: { contentId: { in: pool.map((c) => c.id) } },
    _avg: { score: true },
  });
  const avgMap = new Map(ratingGroups.map((r) => [r.contentId, r._avg.score ?? 0]));

  const scored: RecCandidate[] = pool.map((c) => {
    let score = (avgMap.get(c.id) ?? 0) * 2 + (c._count?.ratings ?? 0) * 0.15;
    if (c.category && categories.has(c.category)) score += 4;
    if (creators.has(c.creatorId)) score += 3;
    if (types.has(c.type)) score += 1.5;
    score += Math.min(5, (trendingMap.get(c.id) ?? 0) * 0.05);
    score += Math.min(8, (coWatchScores.get(c.id) ?? 0) * 0.4);
    if (c.featured) score += 1;
    return {
      ...c,
      trailerUrl: c.trailerUrl,
      videoUrl: c.videoUrl,
      avgRating: avgMap.get(c.id) ?? 0,
      recScore: score,
    };
  });

  scored.sort((a, b) => b.recScore - a.recScore);
  return scored.slice(0, limit);
}
