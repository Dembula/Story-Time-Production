import { prisma } from "@/lib/prisma";

export type NamedCount = { key: string; count: number; label?: string };

export type AiUsageInsights = {
  conversations: {
    total: number;
    activeInWindow: number;
    messagesInWindow: number;
    byScope: NamedCount[];
  };
  actions: {
    total: number;
    successRate: number;
    byAction: NamedCount[];
  };
  requestsByDay: Array<{ day: string; requests: number; errors: number }>;
  conversationsByDay: Array<{ day: string; conversations: number; messages: number }>;
  byUserRole: NamedCount[];
  byModel: NamedCount[];
  byIntent: NamedCount[];
  byTool: NamedCount[];
  topUsers: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    role: string;
    requests: number;
    conversations: number;
    actions: number;
  }>;
  topTopics: NamedCount[];
  sessionIntel: {
    samples: number;
    avgSuggestionAcceptance: number | null;
    topIntents: NamedCount[];
    topNextBestActions: NamedCount[];
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function bump(map: Map<string, number>, key: string, by = 1) {
  const k = key.trim() || "unknown";
  map.set(k, (map.get(k) ?? 0) + by);
}

function toNamedCounts(map: Map<string, number>, limit = 20): NamedCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchAiUsageInsights(since: Date): Promise<AiUsageInsights> {
  const [
    requestRows,
    conversationsTotal,
    conversationsActive,
    messagesInWindow,
    conversationScopes,
    actionRows,
    topicRows,
    sessionRows,
    conversationUsers,
  ] = await Promise.all([
    prisma.aiRequestLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        userId: true,
        modelUsed: true,
        createdAt: true,
        success: true,
        metadata: true,
      },
      take: 8000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.modocConversation.count().catch(() => 0),
    prisma.modocConversation.count({ where: { updatedAt: { gte: since } } }).catch(() => 0),
    prisma.modocMessage.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.modocConversation
      .groupBy({
        by: ["scope"],
        where: { updatedAt: { gte: since } },
        _count: { _all: true },
      })
      .catch(() => [] as Array<{ scope: string | null; _count: { _all: number } }>),
    prisma.modocActionLog
      .findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true, action: true, ok: true, conversationId: true },
        take: 5000,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.modocTopicStat
      .findMany({
        orderBy: { count: "desc" },
        take: 25,
        select: { topic: true, count: true },
      })
      .catch(() => []),
    prisma.modocSessionIntel
      .findMany({
        where: { createdAt: { gte: since } },
        select: {
          userIntent: true,
          nextBestAction: true,
          suggestionAcceptanceRate: true,
        },
        take: 3000,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.modocConversation.findMany({
      where: { updatedAt: { gte: since } },
      select: {
        userId: true,
        scope: true,
        pageContext: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 4000,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const requestsByDayMap = new Map<string, { requests: number; errors: number }>();
  const conversationsByDayMap = new Map<string, { conversations: number; messages: number }>();
  const byModel = new Map<string, number>();
  const byIntent = new Map<string, number>();
  const byTool = new Map<string, number>();
  const requestCountByUser = new Map<string, number>();
  const conversationCountByUser = new Map<string, number>();
  const actionCountByUser = new Map<string, number>();
  const byAction = new Map<string, number>();

  for (const row of requestRows) {
    const day = dayKey(row.createdAt);
    const bucket = requestsByDayMap.get(day) ?? { requests: 0, errors: 0 };
    bucket.requests += 1;
    if (!row.success) bucket.errors += 1;
    requestsByDayMap.set(day, bucket);

    if (row.modelUsed) bump(byModel, row.modelUsed);
    if (row.userId) bump(requestCountByUser, row.userId);

    const meta = asRecord(row.metadata);
    if (meta) {
      if (typeof meta.intentCategory === "string") bump(byIntent, meta.intentCategory);
      if (typeof meta.responseMode === "string") bump(byIntent, `mode:${meta.responseMode}`);
      const page = asRecord(meta.pageContext) ?? asRecord(meta.context);
      if (page && typeof page.tool === "string") bump(byTool, page.tool);
    }
  }

  for (const row of conversationUsers) {
    bump(conversationCountByUser, row.userId);
    const day = dayKey(row.updatedAt);
    const bucket = conversationsByDayMap.get(day) ?? { conversations: 0, messages: 0 };
    bucket.conversations += 1;
    conversationsByDayMap.set(day, bucket);

    const ctx = asRecord(row.pageContext);
    if (ctx) {
      if (typeof ctx.tool === "string") bump(byTool, ctx.tool);
      if (typeof ctx.area === "string") bump(byTool, `area:${ctx.area}`);
      if (typeof ctx.task === "string") bump(byTool, `task:${ctx.task}`);
    }
  }

  // Approximate messages/day from ModocMessage with SQL for accuracy
  let messageDayRows: Array<{ day: string; count: bigint | number }> = [];
  try {
    messageDayRows = (await prisma.$queryRaw`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM "ModocMessage"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `) as Array<{ day: string; count: bigint | number }>;
  } catch {
    messageDayRows = [];
  }
  for (const row of messageDayRows) {
    const day = String(row.day);
    const bucket = conversationsByDayMap.get(day) ?? { conversations: 0, messages: 0 };
    bucket.messages = Number(row.count) || 0;
    conversationsByDayMap.set(day, bucket);
  }

  let actionOk = 0;
  for (const row of actionRows) {
    bump(byAction, row.action);
    bump(actionCountByUser, row.userId);
    if (row.ok) actionOk += 1;
  }

  const userIds = [
    ...new Set([
      ...requestCountByUser.keys(),
      ...conversationCountByUser.keys(),
      ...actionCountByUser.keys(),
    ]),
  ].slice(0, 200);

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const byUserRole = new Map<string, number>();
  for (const [userId, count] of requestCountByUser) {
    const role = userById.get(userId)?.role ?? "UNKNOWN";
    bump(byUserRole, role, count);
  }
  for (const [userId, count] of conversationCountByUser) {
    const role = userById.get(userId)?.role ?? "UNKNOWN";
    // Prefer request counts for role mix; still count conversation-only users lightly
    if (!requestCountByUser.has(userId)) bump(byUserRole, role, count);
  }

  const topUsers = userIds
    .map((userId) => {
      const u = userById.get(userId);
      return {
        userId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        role: u?.role ?? "UNKNOWN",
        requests: requestCountByUser.get(userId) ?? 0,
        conversations: conversationCountByUser.get(userId) ?? 0,
        actions: actionCountByUser.get(userId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.requests + b.conversations * 2 + b.actions - (a.requests + a.conversations * 2 + a.actions),
    )
    .slice(0, 20);

  const intentFromSession = new Map<string, number>();
  const nextBest = new Map<string, number>();
  let suggestionSum = 0;
  let suggestionN = 0;
  for (const row of sessionRows) {
    if (row.userIntent) bump(intentFromSession, row.userIntent);
    if (row.nextBestAction) bump(nextBest, row.nextBestAction);
    if (typeof row.suggestionAcceptanceRate === "number") {
      suggestionSum += row.suggestionAcceptanceRate;
      suggestionN += 1;
    }
  }
  for (const [k, v] of intentFromSession) bump(byIntent, k, v);

  const requestsByDay = [...requestsByDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, requests: v.requests, errors: v.errors }));

  const conversationsByDay = [...conversationsByDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, conversations: v.conversations, messages: v.messages }));

  return {
    conversations: {
      total: conversationsTotal,
      activeInWindow: conversationsActive,
      messagesInWindow,
      byScope: conversationScopes.map((row) => ({
        key: row.scope || "unscoped",
        count: row._count._all,
      })),
    },
    actions: {
      total: actionRows.length,
      successRate:
        actionRows.length > 0
          ? Math.round((actionOk / actionRows.length) * 1000) / 10
          : 0,
      byAction: toNamedCounts(byAction, 25),
    },
    requestsByDay,
    conversationsByDay,
    byUserRole: toNamedCounts(byUserRole),
    byModel: toNamedCounts(byModel),
    byIntent: toNamedCounts(byIntent, 25),
    byTool: toNamedCounts(byTool, 25),
    topUsers,
    topTopics: topicRows.map((t) => ({ key: t.topic, count: t.count })),
    sessionIntel: {
      samples: sessionRows.length,
      avgSuggestionAcceptance:
        suggestionN > 0 ? Math.round((suggestionSum / suggestionN) * 1000) / 10 : null,
      topIntents: toNamedCounts(intentFromSession, 15),
      topNextBestActions: toNamedCounts(nextBest, 15),
    },
  };
}
