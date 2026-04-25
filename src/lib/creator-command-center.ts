import { prisma } from "@/lib/prisma";
import { getCreatorAnalytics, type CreatorAnalytics } from "@/lib/creator-analytics";

export type CreatorCommandCenterPayload = {
  analytics: CreatorAnalytics;
  overview: {
    activeProjects: number;
    topFilmTitle: string | null;
    topFilmViews: number;
    topFilmRevenueRand: number;
    viewerGrowth7dPct: number | null;
    engagementRateApprox: number;
    viewsLast7d: number;
    viewsPrev7d: number;
  };
  production: {
    shootDaysTotal: number;
    openIncidents: number;
    callSheetsSaved: number;
    tasksByStatus: Record<string, number>;
  };
  ai: {
    modocConversationsInRange: number;
    modocUserMessagesInRange: number;
    topTasks: { task: string; count: number }[];
  };
  platform?: {
    /** Watch sessions platform-wide, last 7 days (admin only) */
    totalWatchSessions7d: number;
  };
};

function projectWhereForCreator(creatorId: string) {
  return {
    OR: [{ pitches: { some: { creatorId } } }, { members: { some: { userId: creatorId } } }],
  };
}

export async function getCreatorCommandCenter(
  creatorId: string,
  role: string,
  options?: { range?: string },
): Promise<CreatorCommandCenterPayload> {
  const analytics = await getCreatorAnalytics(creatorId, options);
  const { start, end } = { start: new Date(analytics.period.start), end: new Date(analytics.period.end) };

  const projects = await prisma.originalProject.findMany({
    where: projectWhereForCreator(creatorId),
    select: { id: true, title: true, phase: true },
  });
  const projectIds = projects.map((p) => p.id);
  const activeProjects = projects.filter((p) => !["WRAPPED", "ARCHIVED", "CANCELLED"].includes(p.phase ?? "")).length;

  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000);
  const d14 = new Date(now - 14 * 86400000);

  const [viewsLast7d, viewsPrev7d, openIncidents, callSheetsSaved, taskGroups, shootDaysTotal, modocConvs, modocUserMsgs, platformSessions7d] =
    await Promise.all([
      prisma.watchSession.count({
        where: { content: { creatorId }, startedAt: { gte: d7 } },
      }),
      prisma.watchSession.count({
        where: { content: { creatorId }, startedAt: { gte: d14, lt: d7 } },
      }),
      projectIds.length
        ? prisma.incidentReport.count({
            where: { projectId: { in: projectIds }, resolved: false },
          })
        : 0,
      projectIds.length
        ? prisma.callSheet.count({
            where: { projectId: { in: projectIds } },
          })
        : 0,
      projectIds.length
        ? prisma.projectTask.groupBy({
            by: ["status"],
            where: { projectId: { in: projectIds } },
            _count: { id: true },
          })
        : [],
      projectIds.length
        ? prisma.shootDay.count({
            where: { projectId: { in: projectIds } },
          })
        : 0,
      prisma.modocConversation.count({
        where: { userId: creatorId, createdAt: { gte: start, lte: end } },
      }),
      prisma.modocMessage.count({
        where: {
          role: "user",
          createdAt: { gte: start, lte: end },
          conversation: { userId: creatorId },
        },
      }),
      role === "ADMIN" ? prisma.watchSession.count({ where: { startedAt: { gte: d7 } } }) : 0,
    ]);

  const tasksByStatus: Record<string, number> = {};
  for (const row of taskGroups) {
    tasksByStatus[row.status] = row._count.id;
  }

  const contentSorted = [...analytics.contentPerformance].sort((a, b) => b.views - a.views);
  const top = contentSorted[0];
  const topFilmRevenueRand =
    top && analytics.revenue.totalViews > 0 ? (top.views / Math.max(1, analytics.revenue.totalViews)) * analytics.revenue.amount : 0;

  const uw = analytics.engagement.uniqueWatchers;
  const engagementRateApprox =
    uw > 0
      ? Math.min(
          100,
          Math.round(
            ((analytics.engagement.totalComments + analytics.engagement.totalRatings + analytics.engagement.watchlistCount) /
              Math.max(1, uw)) *
              10,
          ),
        )
      : 0;

  const viewerGrowth7dPct =
    viewsPrev7d > 0 ? Math.round(((viewsLast7d - viewsPrev7d) / viewsPrev7d) * 1000) / 10 : viewsLast7d > 0 ? 100 : null;

  const convs = await prisma.modocConversation.findMany({
    where: { userId: creatorId, createdAt: { gte: start, lte: end } },
    select: { pageContext: true },
    take: 500,
  });
  const taskCounts = new Map<string, number>();
  for (const c of convs) {
    const ctx = c.pageContext as { task?: string } | null;
    const t = typeof ctx?.task === "string" ? ctx.task : "general";
    taskCounts.set(t, (taskCounts.get(t) ?? 0) + 1);
  }
  const topTasks = [...taskCounts.entries()]
    .map(([task, count]) => ({ task, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const payload: CreatorCommandCenterPayload = {
    analytics,
    overview: {
      activeProjects,
      topFilmTitle: top?.title ?? null,
      topFilmViews: top?.views ?? 0,
      topFilmRevenueRand: Math.round(topFilmRevenueRand * 100) / 100,
      viewerGrowth7dPct,
      engagementRateApprox,
      viewsLast7d,
      viewsPrev7d,
    },
    production: {
      shootDaysTotal,
      openIncidents,
      callSheetsSaved,
      tasksByStatus,
    },
    ai: {
      modocConversationsInRange: modocConvs,
      modocUserMessagesInRange: modocUserMsgs,
      topTasks,
    },
  };

  if (role === "ADMIN") {
    payload.platform = {
      totalWatchSessions7d: platformSessions7d,
    };
  }

  return payload;
}
