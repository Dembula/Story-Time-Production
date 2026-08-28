import { prisma } from "@/lib/prisma";

export const AGE_BRACKET_ORDER = [
  "Under 13",
  "13–17",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55+",
  "Unknown",
] as const;

export type AgeBracket = (typeof AGE_BRACKET_ORDER)[number];

export type AgeDistributionRow = {
  bracket: AgeBracket;
  viewers: number;
  pct: number;
};

export type TitleAudienceRow = {
  contentId: string;
  title: string;
  totalViewers: number;
  ageDistribution: AgeDistributionRow[];
};

export type CreatorEngagementComment = {
  id: string;
  contentId: string;
  contentTitle: string;
  body: string;
  createdAt: string;
  viewer: {
    id: string;
    displayName: string;
    image: string | null;
    ageBracket: AgeBracket | null;
  };
  replies: Array<{
    id: string;
    body: string;
    createdAt: string;
    viewer: {
      id: string;
      displayName: string;
      image: string | null;
    };
  }>;
};

export type CreatorEngagementRating = {
  id: string;
  contentId: string;
  contentTitle: string;
  score: number;
  createdAt: string;
  viewer: {
    id: string;
    displayName: string;
    image: string | null;
    ageBracket: AgeBracket | null;
  };
};

export type CreatorAudienceInsights = {
  ageDistribution: AgeDistributionRow[];
  totalViewers: number;
  viewersWithKnownAge: number;
  byTitle: TitleAudienceRow[];
};

export type CreatorEngagementInsights = {
  comments: CreatorEngagementComment[];
  ratings: CreatorEngagementRating[];
};

export function ageToBracket(age: number): AgeBracket {
  if (age < 13) return "Under 13";
  if (age < 18) return "13–17";
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  return "55+";
}

function emptyDistribution(): AgeDistributionRow[] {
  return AGE_BRACKET_ORDER.map((bracket) => ({ bracket, viewers: 0, pct: 0 }));
}

function buildDistribution(counts: Map<AgeBracket, number>): AgeDistributionRow[] {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return AGE_BRACKET_ORDER.map((bracket) => {
    const viewers = counts.get(bracket) ?? 0;
    return {
      bracket,
      viewers,
      pct: total > 0 ? Math.round((viewers / total) * 1000) / 10 : 0,
    };
  });
}

function viewerDisplayName(user: { name: string | null; email: string | null }): string {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? "Viewer";
  return "Viewer";
}

/**
 * Unique viewers per age bracket from watch sessions (profile age when available).
 * No IP, device, or exact DOB is exposed — only aggregated brackets.
 */
export async function getCreatorAudienceInsights(
  creatorId: string,
  start: Date,
  end: Date,
): Promise<CreatorAudienceInsights> {
  const sessions = await prisma.watchSession.findMany({
    where: {
      content: { creatorId },
      startedAt: { gte: start, lte: end },
    },
    select: {
      userId: true,
      contentId: true,
      viewerProfileId: true,
      viewerProfile: { select: { age: true } },
      content: { select: { title: true } },
    },
  });

  const overallKeys = new Map<string, AgeBracket>();
  const titleKeys = new Map<string, Map<string, AgeBracket>>();
  const titleNames = new Map<string, string>();

  for (const session of sessions) {
    titleNames.set(session.contentId, session.content.title);
    const viewerKey = session.viewerProfileId ?? `user:${session.userId}`;
    const bracket = session.viewerProfile?.age != null ? ageToBracket(session.viewerProfile.age) : "Unknown";

    if (!overallKeys.has(viewerKey)) overallKeys.set(viewerKey, bracket);

    let perTitle = titleKeys.get(session.contentId);
    if (!perTitle) {
      perTitle = new Map();
      titleKeys.set(session.contentId, perTitle);
    }
    if (!perTitle.has(viewerKey)) perTitle.set(viewerKey, bracket);
  }

  const overallCounts = new Map<AgeBracket, number>();
  let viewersWithKnownAge = 0;
  for (const bracket of overallKeys.values()) {
    overallCounts.set(bracket, (overallCounts.get(bracket) ?? 0) + 1);
    if (bracket !== "Unknown") viewersWithKnownAge += 1;
  }

  const byTitle: TitleAudienceRow[] = [...titleKeys.entries()].map(([contentId, viewers]) => {
    const counts = new Map<AgeBracket, number>();
    for (const bracket of viewers.values()) {
      counts.set(bracket, (counts.get(bracket) ?? 0) + 1);
    }
    return {
      contentId,
      title: titleNames.get(contentId) ?? "Untitled",
      totalViewers: viewers.size,
      ageDistribution: buildDistribution(counts),
    };
  });

  byTitle.sort((a, b) => b.totalViewers - a.totalViewers);

  return {
    ageDistribution: buildDistribution(overallCounts),
    totalViewers: overallKeys.size,
    viewersWithKnownAge,
    byTitle,
  };
}

async function buildViewerAgeLookup(
  creatorId: string,
  pairs: Array<{ userId: string; contentId: string }>,
): Promise<Map<string, AgeBracket>> {
  if (pairs.length === 0) return new Map();

  const contentIds = [...new Set(pairs.map((p) => p.contentId))];
  const userIds = [...new Set(pairs.map((p) => p.userId))];

  const sessions = await prisma.watchSession.findMany({
    where: {
      contentId: { in: contentIds },
      userId: { in: userIds },
      content: { creatorId },
      viewerProfileId: { not: null },
    },
    select: {
      userId: true,
      contentId: true,
      startedAt: true,
      viewerProfile: { select: { age: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const lookup = new Map<string, AgeBracket>();
  for (const session of sessions) {
    const key = `${session.userId}:${session.contentId}`;
    if (lookup.has(key) || session.viewerProfile?.age == null) continue;
    lookup.set(key, ageToBracket(session.viewerProfile.age));
  }
  return lookup;
}

export async function getCreatorEngagementInsights(
  creatorId: string,
  start: Date,
  end: Date,
  limit = 80,
): Promise<CreatorEngagementInsights> {
  const [commentRows, ratingRows] = await Promise.all([
    prisma.comment.findMany({
      where: {
        content: { creatorId },
        parentId: null,
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        content: { select: { id: true, title: true } },
        replies: {
          include: { user: { select: { id: true, name: true, image: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.rating.findMany({
      where: {
        content: { creatorId },
        createdAt: { gte: start, lte: end },
      },
      include: {
        user: { select: { id: true, name: true, image: true, email: true } },
        content: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const pairs = [
    ...commentRows.map((c) => ({ userId: c.userId, contentId: c.contentId })),
    ...ratingRows.map((r) => ({ userId: r.userId, contentId: r.contentId })),
    ...commentRows.flatMap((c) =>
      c.replies.map((reply) => ({ userId: reply.userId, contentId: c.contentId })),
    ),
  ];
  const ageLookup = await buildViewerAgeLookup(creatorId, pairs);

  const comments: CreatorEngagementComment[] = commentRows.map((comment) => ({
    id: comment.id,
    contentId: comment.contentId,
    contentTitle: comment.content.title,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    viewer: {
      id: comment.user.id,
      displayName: viewerDisplayName(comment.user),
      image: comment.user.image,
      ageBracket: ageLookup.get(`${comment.userId}:${comment.contentId}`) ?? null,
    },
    replies: comment.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      createdAt: reply.createdAt.toISOString(),
      viewer: {
        id: reply.user.id,
        displayName: viewerDisplayName(reply.user),
        image: reply.user.image,
      },
    })),
  }));

  const ratings: CreatorEngagementRating[] = ratingRows.map((rating) => ({
    id: rating.id,
    contentId: rating.contentId,
    contentTitle: rating.content.title,
    score: rating.score,
    createdAt: rating.createdAt.toISOString(),
    viewer: {
      id: rating.user.id,
      displayName: viewerDisplayName(rating.user),
      image: rating.user.image,
      ageBracket: ageLookup.get(`${rating.userId}:${rating.contentId}`) ?? null,
    },
  }));

  return { comments, ratings };
}

export async function getTitleAudienceInsights(
  creatorId: string,
  contentId: string,
  start: Date,
  end: Date,
): Promise<{ title: string; ageDistribution: AgeDistributionRow[]; totalViewers: number } | null> {
  const content = await prisma.content.findFirst({
    where: { id: contentId, creatorId },
    select: { id: true, title: true },
  });
  if (!content) return null;

  const all = await getCreatorAudienceInsights(creatorId, start, end);
  const row = all.byTitle.find((t) => t.contentId === contentId);
  return {
    title: content.title,
    totalViewers: row?.totalViewers ?? 0,
    ageDistribution: row?.ageDistribution ?? emptyDistribution(),
  };
}
