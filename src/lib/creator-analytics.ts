import { prisma } from "./prisma";
import { getCreatorRevenue, getViewerSubscriptionRevenue } from "./revenue";

export type AnalyticsRangeKey = "7d" | "30d" | "month" | "all";

function resolveAnalyticsWindow(range: string | undefined): { start: Date; end: Date; key: AnalyticsRangeKey } {
  const end = new Date();
  if (range === "7d") return { start: new Date(end.getTime() - 7 * 86400000), end, key: "7d" };
  if (range === "30d") return { start: new Date(end.getTime() - 30 * 86400000), end, key: "30d" };
  if (range === "all") return { start: new Date(0), end, key: "all" };
  return {
    start: new Date(end.getFullYear(), end.getMonth(), 1),
    end,
    key: "month",
  };
}

export type CreatorAnalytics = {
  rangeKey: AnalyticsRangeKey;
  period: { start: string; end: string };
  revenue: {
    amount: number;
    watchTimeSeconds: number;
    sharePercent: number;
    totalViews: number;
    streamCount: number;
    perViewRand: number;
    perStreamRand: number;
    creatorPool: number;
    viewerSubRevenue: number;
  };
  engagement: {
    totalViews: number;
    uniqueWatchers: number;
    averageWatchTimeSeconds: number;
    totalWatchTimeSeconds: number;
    totalComments: number;
    totalRatings: number;
    watchlistCount: number;
    contentCount: number;
  };
  contentPerformance: Array<{
    id: string;
    title: string;
    type: string;
    views: number;
    watchTimeSeconds: number;
    comments: number;
    ratings: number;
    watchlistAdds: number;
    avgRating: number | null;
  }>;
  projects: {
    total: number;
    byPhase: Record<string, number>;
    byStatus: Record<string, number>;
  };
  competition: {
    periodName: string | null;
    endDate: string | null;
    rank: number | null;
    voteCount: number;
  } | null;
};

export async function getCreatorAnalytics(
  creatorId: string,
  options?: { range?: string },
): Promise<CreatorAnalytics> {
  const { start: windowStart, end: periodEnd, key: rangeKey } = resolveAnalyticsWindow(options?.range);
  const [revenueResult, watchSessions, totalViewsPeriod, totalViewsAllTime, uniqueWatchers, watchTimeAgg, contentCount, totalComments, totalRatings, watchlistCount, contentList, projects, competitionPeriod, creatorVotes] = await Promise.all([
    getCreatorRevenue(creatorId, windowStart, periodEnd),
    prisma.watchSession.findMany({
      where: { content: { creatorId }, startedAt: { gte: windowStart, lte: periodEnd } },
      select: { durationSeconds: true, contentId: true },
    }),
    prisma.watchSession.count({
      where: { content: { creatorId }, startedAt: { gte: windowStart, lte: periodEnd } },
    }),
    prisma.watchSession.count({ where: { content: { creatorId } } }),
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: { content: { creatorId } },
    }).then((r) => r.length),
    prisma.watchSession.aggregate({
      where: { content: { creatorId } },
      _avg: { durationSeconds: true },
      _sum: { durationSeconds: true },
    }),
    prisma.content.count({ where: { creatorId } }),
    prisma.comment.count({ where: { content: { creatorId } } }),
    prisma.rating.count({ where: { content: { creatorId } } }),
    prisma.watchlistItem.count({ where: { content: { creatorId } } }),
    prisma.content.findMany({
      where: { creatorId },
      select: {
        id: true,
        title: true,
        type: true,
        _count: {
          select: {
            watchSessions: true,
            comments: true,
            ratings: true,
            watchlist: true,
          },
        },
      },
    }),
    prisma.originalProject.findMany({
      where: {
        OR: [
          { pitches: { some: { creatorId } } },
          { members: { some: { userId: creatorId } } },
        ],
      },
      select: { phase: true, status: true },
    }),
    prisma.competitionPeriod.findFirst({
      where: { status: "OPEN" },
      orderBy: { endDate: "desc" },
      select: { id: true, name: true, endDate: true },
    }),
    (async () => {
      const period = await prisma.competitionPeriod.findFirst({ where: { status: "OPEN" }, select: { id: true } });
      if (!period) return { rank: null as number | null, voteCount: 0 };
      const [votes, myVotes] = await Promise.all([
        prisma.creatorVote.groupBy({
          by: ["creatorId"],
          where: { competitionPeriodId: period.id },
          _count: { id: true },
        }),
        prisma.creatorVote.count({ where: { competitionPeriodId: period.id, creatorId } }),
      ]);
      const sorted = votes.sort((a, b) => b._count.id - a._count.id);
      const rank = sorted.findIndex((v) => v.creatorId === creatorId) + 1 || null;
      return { rank, voteCount: myVotes };
    })(),
  ]);

  const viewerSubRevenue = await getViewerSubscriptionRevenue(windowStart, periodEnd);
  const creatorPool = viewerSubRevenue * 0.6;
  const perViewRand = totalViewsPeriod > 0 ? revenueResult.revenue / totalViewsPeriod : 0;
  const perStreamRand = watchSessions.length > 0 ? revenueResult.revenue / watchSessions.length : 0;

  const contentWithWatchTime = await Promise.all(
    contentList.map(async (c) => {
      const wt = await prisma.watchSession.aggregate({
        where: { contentId: c.id },
        _sum: { durationSeconds: true },
      });
      const avgR = await prisma.rating.aggregate({
        where: { contentId: c.id },
        _avg: { score: true },
      });
      return {
        id: c.id,
        title: c.title,
        type: c.type,
        views: c._count.watchSessions,
        watchTimeSeconds: wt._sum.durationSeconds ?? 0,
        comments: c._count.comments,
        ratings: c._count.ratings,
        watchlistAdds: c._count.watchlist,
        avgRating: avgR._avg.score ?? null,
      };
    })
  );

  const byPhase: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  projects.forEach((p) => {
    byPhase[p.phase] = (byPhase[p.phase] ?? 0) + 1;
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  });

  return {
    rangeKey,
    period: {
      start: windowStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    revenue: {
      amount: revenueResult.revenue,
      watchTimeSeconds: revenueResult.watchTime,
      sharePercent: revenueResult.share,
      totalViews: totalViewsPeriod,
      streamCount: watchSessions.length,
      perViewRand: Math.round(perViewRand * 100) / 100,
      perStreamRand: Math.round(perStreamRand * 100) / 100,
      creatorPool,
      viewerSubRevenue,
    },
    engagement: {
      totalViews: totalViewsAllTime,
      uniqueWatchers,
      averageWatchTimeSeconds: watchTimeAgg._avg.durationSeconds ?? 0,
      totalWatchTimeSeconds: watchTimeAgg._sum.durationSeconds ?? 0,
      totalComments,
      totalRatings,
      watchlistCount,
      contentCount,
    },
    contentPerformance: contentWithWatchTime.sort((a, b) => b.views - a.views).slice(0, 20),
    projects: {
      total: projects.length,
      byPhase,
      byStatus,
    },
    competition: competitionPeriod
      ? {
          periodName: competitionPeriod.name,
          endDate: competitionPeriod.endDate?.toISOString() ?? null,
          rank: creatorVotes.rank,
          voteCount: creatorVotes.voteCount,
        }
      : null,
  };
}
