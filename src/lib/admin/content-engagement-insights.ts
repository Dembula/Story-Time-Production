import { prisma } from "@/lib/prisma";
import { getViewerPoolRevenue } from "@/lib/revenue";
import { revenueEligibleWatchSessionWhere } from "@/lib/revenue-eligible-watch";
import { getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT } from "@/lib/payments/config";
import { getCalendarMonthToDateRange } from "@/lib/financial-ledger";

export type AdminContentViewerEngagementRow = {
  userId: string;
  displayName: string;
  email: string | null;
  sessionCount: number;
  watchSeconds: number;
  eligibleSessionCount: number;
  eligibleWatchSeconds: number;
  firstWatchedAt: string | null;
  lastWatchedAt: string | null;
  mtdWatchSeconds: number;
  mtdEligibleWatchSeconds: number;
  /** Share of this title's eligible watch time (0–100). */
  titleEligibleSharePct: number;
  /** Estimated ZAR attributed to creator pool from this viewer's eligible watch on this title (all-time). */
  attributedCreatorZarAllTime: number;
  /** Estimated ZAR attributed to creator pool from this viewer's eligible watch on this title (MTD). */
  attributedCreatorZarMtd: number;
};

export type AdminContentEngagementInsights = {
  contentId: string;
  title: string;
  creator: { id: string; name: string | null; email: string | null };
  split: {
    creatorPct: number;
    platformPct: number;
  };
  windows: {
    allTime: EngagementWindowStats;
    monthToDate: EngagementWindowStats & {
      periodStart: string;
      periodEnd: string;
      periodLabel: string;
    };
  };
  explanation: {
    summary: string;
    bullets: string[];
  };
  viewers: AdminContentViewerEngagementRow[];
  viewerCount: number;
};

type EngagementWindowStats = {
  uniqueViewers: number;
  sessionCount: number;
  watchSeconds: number;
  eligibleSessionCount: number;
  eligibleWatchSeconds: number;
  platformEligibleWatchSeconds: number;
  viewerPoolZar: number;
  creatorPoolZar: number;
  platformRetainZar: number;
  /** This title's share of platform eligible watch (0–100). */
  platformWatchSharePct: number;
  /** Estimated creator-pool ZAR attributed to this title. */
  titleCreatorAttributionZar: number;
  /** Estimated platform-retain ZAR proportional to this title's watch share. */
  titlePlatformAttributionZar: number;
  /** Creator's total eligible watch across their catalogue in this window. */
  creatorCatalogueEligibleSeconds: number;
  /** Estimated ZAR for the creator overall in this window (catalogue-wide). */
  creatorCatalogueRevenueZar: number;
  /** This title's share of the creator's own catalogue eligible watch (0–100). */
  titleShareOfCreatorCataloguePct: number;
};

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function roundPct(ratio: number): number {
  return Math.round(ratio * 10000) / 100;
}

function displayName(user: { name: string | null; email: string | null }): string {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? "Viewer";
  return "Viewer";
}

function emptyWindow(): EngagementWindowStats {
  return {
    uniqueViewers: 0,
    sessionCount: 0,
    watchSeconds: 0,
    eligibleSessionCount: 0,
    eligibleWatchSeconds: 0,
    platformEligibleWatchSeconds: 0,
    viewerPoolZar: 0,
    creatorPoolZar: 0,
    platformRetainZar: 0,
    platformWatchSharePct: 0,
    titleCreatorAttributionZar: 0,
    titlePlatformAttributionZar: 0,
    creatorCatalogueEligibleSeconds: 0,
    creatorCatalogueRevenueZar: 0,
    titleShareOfCreatorCataloguePct: 0,
  };
}

function buildWindowStats(args: {
  uniqueViewers: number;
  sessionCount: number;
  watchSeconds: number;
  eligibleSessionCount: number;
  eligibleWatchSeconds: number;
  platformEligibleWatchSeconds: number;
  viewerPoolZar: number;
  creatorSplit: number;
  platformSplit: number;
  creatorCatalogueEligibleSeconds: number;
}): EngagementWindowStats {
  const creatorPoolZar = roundMoney(args.viewerPoolZar * args.creatorSplit);
  const platformRetainZar = roundMoney(args.viewerPoolZar * args.platformSplit);
  const platformWatchShare =
    args.platformEligibleWatchSeconds > 0
      ? args.eligibleWatchSeconds / args.platformEligibleWatchSeconds
      : 0;
  const titleCreatorAttributionZar = roundMoney(platformWatchShare * creatorPoolZar);
  const titlePlatformAttributionZar = roundMoney(platformWatchShare * platformRetainZar);
  const titleShareOfCreatorCatalogue =
    args.creatorCatalogueEligibleSeconds > 0
      ? args.eligibleWatchSeconds / args.creatorCatalogueEligibleSeconds
      : 0;
  const creatorCatalogueRevenueZar =
    args.platformEligibleWatchSeconds > 0
      ? roundMoney((args.creatorCatalogueEligibleSeconds / args.platformEligibleWatchSeconds) * creatorPoolZar)
      : 0;

  return {
    uniqueViewers: args.uniqueViewers,
    sessionCount: args.sessionCount,
    watchSeconds: args.watchSeconds,
    eligibleSessionCount: args.eligibleSessionCount,
    eligibleWatchSeconds: args.eligibleWatchSeconds,
    platformEligibleWatchSeconds: args.platformEligibleWatchSeconds,
    viewerPoolZar: roundMoney(args.viewerPoolZar),
    creatorPoolZar,
    platformRetainZar,
    platformWatchSharePct: roundPct(platformWatchShare),
    titleCreatorAttributionZar,
    titlePlatformAttributionZar,
    creatorCatalogueEligibleSeconds: args.creatorCatalogueEligibleSeconds,
    creatorCatalogueRevenueZar,
    titleShareOfCreatorCataloguePct: roundPct(titleShareOfCreatorCatalogue),
  };
}

/**
 * All-time + month-to-date engagement for one title, with per-viewer watch time
 * and estimated contribution to the creator revenue pool (60/40 of viewer pool).
 */
export async function getAdminContentEngagementInsights(
  contentId: string,
): Promise<AdminContentEngagementInsights | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      creatorId: true,
      creator: { select: { id: true, name: true, email: true } },
    },
  });
  if (!content) return null;

  const { periodStart, periodEnd } = getCalendarMonthToDateRange();
  const feeSettings = await getFinanceFeeSettings();
  const creatorSplit = feeSettings.viewerCreatorSplit || VIEWER_CREATOR_SPLIT;
  const platformSplit = feeSettings.viewerPlatformSplit || VIEWER_PLATFORM_SPLIT;
  const epoch = new Date(0);

  const [
    allGroups,
    eligibleGroups,
    mtdGroups,
    mtdEligibleGroups,
    titleAllAgg,
    titleEligibleAgg,
    titleMtdAgg,
    titleMtdEligibleAgg,
    platformEligibleAll,
    platformEligibleMtd,
    creatorEligibleAll,
    creatorEligibleMtd,
    poolAllTime,
    poolMtd,
  ] = await Promise.all([
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: { contentId },
      _sum: { durationSeconds: true },
      _count: { _all: true },
      _min: { startedAt: true },
      _max: { startedAt: true },
    }),
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: { contentId, ...revenueEligibleWatchSessionWhere },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: { contentId, startedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.groupBy({
      by: ["userId"],
      where: {
        contentId,
        ...revenueEligibleWatchSessionWhere,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: { contentId },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.watchSession.aggregate({
      where: { contentId, ...revenueEligibleWatchSessionWhere },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.watchSession.aggregate({
      where: { contentId, startedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.watchSession.aggregate({
      where: {
        contentId,
        ...revenueEligibleWatchSessionWhere,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.watchSession.aggregate({
      where: revenueEligibleWatchSessionWhere,
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: {
        ...revenueEligibleWatchSessionWhere,
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: {
        ...revenueEligibleWatchSessionWhere,
        content: { creatorId: content.creatorId },
      },
      _sum: { durationSeconds: true },
    }),
    prisma.watchSession.aggregate({
      where: {
        ...revenueEligibleWatchSessionWhere,
        content: { creatorId: content.creatorId },
        startedAt: { gte: periodStart, lte: periodEnd },
      },
      _sum: { durationSeconds: true },
    }),
    getViewerPoolRevenue(epoch, periodEnd),
    getViewerPoolRevenue(periodStart, periodEnd),
  ]);

  const eligibleByUser = new Map(
    eligibleGroups.map((row) => [
      row.userId,
      {
        seconds: row._sum.durationSeconds ?? 0,
        sessions: row._count._all,
      },
    ]),
  );
  const mtdByUser = new Map(mtdGroups.map((row) => [row.userId, row._sum.durationSeconds ?? 0]));
  const mtdEligibleByUser = new Map(
    mtdEligibleGroups.map((row) => [row.userId, row._sum.durationSeconds ?? 0]),
  );

  const userIds = allGroups.map((row) => row.userId);
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        });
  const userById = new Map(users.map((u) => [u.id, u]));

  const titleEligibleAll = titleEligibleAgg._sum.durationSeconds ?? 0;
  const titleEligibleMtd = titleMtdEligibleAgg._sum.durationSeconds ?? 0;
  const platformEligibleAllSec = platformEligibleAll._sum.durationSeconds ?? 0;
  const platformEligibleMtdSec = platformEligibleMtd._sum.durationSeconds ?? 0;

  const allTime = buildWindowStats({
    uniqueViewers: allGroups.length,
    sessionCount: titleAllAgg._count._all,
    watchSeconds: titleAllAgg._sum.durationSeconds ?? 0,
    eligibleSessionCount: titleEligibleAgg._count._all,
    eligibleWatchSeconds: titleEligibleAll,
    platformEligibleWatchSeconds: platformEligibleAllSec,
    viewerPoolZar: poolAllTime,
    creatorSplit,
    platformSplit,
    creatorCatalogueEligibleSeconds: creatorEligibleAll._sum.durationSeconds ?? 0,
  });

  const mtdUnique = new Set([
    ...mtdGroups.map((r) => r.userId),
    ...mtdEligibleGroups.map((r) => r.userId),
  ]).size;

  const monthToDate = {
    ...buildWindowStats({
      uniqueViewers: mtdUnique,
      sessionCount: titleMtdAgg._count._all,
      watchSeconds: titleMtdAgg._sum.durationSeconds ?? 0,
      eligibleSessionCount: titleMtdEligibleAgg._count._all,
      eligibleWatchSeconds: titleEligibleMtd,
      platformEligibleWatchSeconds: platformEligibleMtdSec,
      viewerPoolZar: poolMtd,
      creatorSplit,
      platformSplit,
      creatorCatalogueEligibleSeconds: creatorEligibleMtd._sum.durationSeconds ?? 0,
    }),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    periodLabel: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
  };

  const viewers: AdminContentViewerEngagementRow[] = allGroups
    .map((row) => {
      const user = userById.get(row.userId);
      const eligible = eligibleByUser.get(row.userId) ?? { seconds: 0, sessions: 0 };
      const mtdEligible = mtdEligibleByUser.get(row.userId) ?? 0;
      const titleShareAll = titleEligibleAll > 0 ? eligible.seconds / titleEligibleAll : 0;
      const titleShareMtd = titleEligibleMtd > 0 ? mtdEligible / titleEligibleMtd : 0;

      return {
        userId: row.userId,
        displayName: displayName(user ?? { name: null, email: null }),
        email: user?.email ?? null,
        sessionCount: row._count._all,
        watchSeconds: row._sum.durationSeconds ?? 0,
        eligibleSessionCount: eligible.sessions,
        eligibleWatchSeconds: eligible.seconds,
        firstWatchedAt: row._min.startedAt?.toISOString() ?? null,
        lastWatchedAt: row._max.startedAt?.toISOString() ?? null,
        mtdWatchSeconds: mtdByUser.get(row.userId) ?? 0,
        mtdEligibleWatchSeconds: mtdEligible,
        titleEligibleSharePct: roundPct(titleShareAll),
        attributedCreatorZarAllTime: roundMoney(titleShareAll * allTime.titleCreatorAttributionZar),
        attributedCreatorZarMtd: roundMoney(titleShareMtd * monthToDate.titleCreatorAttributionZar),
      };
    })
    .sort((a, b) => b.eligibleWatchSeconds - a.eligibleWatchSeconds || b.watchSeconds - a.watchSeconds);

  const creatorPct = Math.round(creatorSplit * 100);
  const platformPct = Math.round(platformSplit * 100);

  return {
    contentId: content.id,
    title: content.title,
    creator: content.creator,
    split: { creatorPct, platformPct },
    windows: { allTime, monthToDate },
    explanation: {
      summary: `Viewer subscription and PPV cash (net) funds a pool. ${creatorPct}% goes to creators, split by revenue-eligible watch time across the platform. ${platformPct}% stays with Story Time.`,
      bullets: [
        "Only sessions marked revenue-eligible count toward creator splits (paid subscriptions / completed PPV — not free trials).",
        "Payouts are settled monthly at creator level; per-viewer and per-title ZAR figures here are proportional attributions from that pool math.",
        "All-time uses every eligible watch and every succeeded viewer-pool payment to date; Month-to-date matches the live finance window used for distribution.",
        "A viewer with watch time but R0 attribution usually means their sessions were not revenue-eligible.",
      ],
    },
    viewers,
    viewerCount: viewers.length,
  };
}
