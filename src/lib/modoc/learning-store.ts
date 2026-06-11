import "server-only";

import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import {
  MAX_ACTION_LOG_IN_PROMPT,
  MAX_ACTION_LOG_ROWS,
  MAX_PLAYBOOK_JSON_FALLBACK,
  MAX_PLAYBOOK_RULES_IN_PROMPT,
  MAX_PLAYBOOK_RULES_STORED,
  MAX_RECENT_ACTIONS_JSON,
  MAX_TOPIC_STATS,
  MAX_TOPIC_STATS_IN_PROMPT,
  PLAYBOOK_PRUNE_MIN_CONFIDENCE,
  scorePlaybookRule,
} from "./learning-limits";
import type { ModocLearningProfile, ModocPlaybookEntry, ModocRecentAction } from "./learning";

export function playbookRuleKey(when: string, then: string): string {
  return `${when.slice(0, 80)}::${then.slice(0, 80)}`.replace(/\s+/g, "_").toLowerCase();
}

function toPlaybookEntry(row: {
  ruleKey: string;
  whenText: string;
  thenText: string;
  origin: string;
  version: number;
  hits: number;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}): ModocPlaybookEntry {
  return {
    id: row.ruleKey,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    when: row.whenText,
    then: row.thenText,
    origin: row.origin as ModocPlaybookEntry["origin"],
    hits: row.hits,
    confidence: row.confidence,
  };
}

function toRecentAction(row: {
  action: string;
  payload: unknown;
  ok: boolean;
  message: string | null;
  eventId: string | null;
  taskIds: unknown;
  conversationId: string | null;
  createdAt: Date;
}): ModocRecentAction {
  return {
    at: row.createdAt.toISOString(),
    action: row.action,
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : undefined,
    ok: row.ok,
    message: row.message ?? undefined,
    eventId: row.eventId ?? undefined,
    taskIds: Array.isArray(row.taskIds) ? (row.taskIds as string[]) : undefined,
    conversationId: row.conversationId ?? undefined,
  };
}

/** Migrate legacy JSON playbook/actions into DB tables (once per user). */
export async function migrateJsonLearningToDb(
  userId: string,
  profile: ModocLearningProfile,
): Promise<void> {
  const [ruleCount, logCount] = await Promise.all([
    prisma.modocPlaybookRule.count({ where: { userId } }),
    prisma.modocActionLog.count({ where: { userId } }),
  ]);

  if (ruleCount === 0 && (profile.playbook?.length ?? 0) > 0) {
    await upsertPlaybookEntries(userId, profile.playbook!.slice(-MAX_PLAYBOOK_JSON_FALLBACK));
  }

  if (logCount === 0 && (profile.recentActions?.length ?? 0) > 0) {
    for (const action of profile.recentActions!.slice(-MAX_RECENT_ACTIONS_JSON)) {
      await appendActionLog(userId, action);
    }
  }

  if (profile.topicCounts) {
    for (const [topic, count] of Object.entries(profile.topicCounts)) {
      if (count <= 0) continue;
      await prisma.modocTopicStat.upsert({
        where: { userId_topic: { userId, topic } },
        create: { userId, topic, count },
        update: { count },
      });
    }
  }
}

export async function upsertPlaybookEntries(
  userId: string,
  entries: Array<
    Pick<ModocPlaybookEntry, "when" | "then" | "origin" | "confidence"> & { id?: string }
  >,
): Promise<void> {
  if (entries.length === 0) return;

  const now = new Date();
  await prisma.$transaction(
    entries.map((entry) => {
      const ruleKey = entry.id ?? playbookRuleKey(entry.when, entry.then);
      return prisma.modocPlaybookRule.upsert({
        where: { userId_ruleKey: { userId, ruleKey } },
        create: {
          userId,
          ruleKey,
          whenText: entry.when,
          thenText: entry.then,
          origin: entry.origin,
          confidence: entry.confidence ?? 0.55,
          hits: 1,
          version: 1,
        },
        update: {
          hits: { increment: 1 },
          confidence: { increment: 0.05 },
          version: { increment: 1 },
          updatedAt: now,
        },
      });
    }),
  );

  await prunePlaybookRules(userId);
}

async function prunePlaybookRules(userId: string): Promise<void> {
  const count = await prisma.modocPlaybookRule.count({ where: { userId } });
  if (count <= MAX_PLAYBOOK_RULES_STORED) return;

  const excess = count - MAX_PLAYBOOK_RULES_STORED;
  const lowConfidence = await prisma.modocPlaybookRule.findMany({
    where: { userId, confidence: { lt: PLAYBOOK_PRUNE_MIN_CONFIDENCE } },
    orderBy: [{ hits: "asc" }, { updatedAt: "asc" }],
    take: excess,
    select: { id: true },
  });

  if (lowConfidence.length >= excess) {
    await prisma.modocPlaybookRule.deleteMany({
      where: { id: { in: lowConfidence.map((r) => r.id) } },
    });
    return;
  }

  const remaining = excess - lowConfidence.length;
  const oldest = await prisma.modocPlaybookRule.findMany({
    where: { userId, id: { notIn: lowConfidence.map((r) => r.id) } },
    orderBy: [{ hits: "asc" }, { confidence: "asc" }, { updatedAt: "asc" }],
    take: remaining,
    select: { id: true },
  });

  const ids = [...lowConfidence, ...oldest].map((r) => r.id);
  if (ids.length > 0) {
    await prisma.modocPlaybookRule.deleteMany({ where: { id: { in: ids } } });
  }
}

export async function getTopPlaybookRules(
  userId: string,
  limit = MAX_PLAYBOOK_RULES_IN_PROMPT,
): Promise<ModocPlaybookEntry[]> {
  const rows = await prisma.modocPlaybookRule.findMany({
    where: { userId },
    take: Math.min(limit * 3, 500),
    orderBy: [{ hits: "desc" }, { confidence: "desc" }, { updatedAt: "desc" }],
  });

  return rows
    .map(toPlaybookEntry)
    .sort((a, b) => scorePlaybookRule(b) - scorePlaybookRule(a))
    .slice(0, limit);
}

export async function getPlaybookRuleCount(userId: string): Promise<number> {
  return prisma.modocPlaybookRule.count({ where: { userId } });
}

export async function appendActionLog(userId: string, entry: ModocRecentAction): Promise<void> {
  await prisma.modocActionLog.create({
    data: {
      userId,
      action: entry.action,
      payload: (entry.payload ?? undefined) as InputJsonValue | undefined,
      ok: entry.ok !== false,
      message: entry.message ?? null,
      eventId: entry.eventId ?? null,
      taskIds: entry.taskIds ? (entry.taskIds as InputJsonValue) : undefined,
      conversationId: entry.conversationId ?? null,
    },
  });

  const count = await prisma.modocActionLog.count({ where: { userId } });
  if (count <= MAX_ACTION_LOG_ROWS) return;

  const toRemove = count - MAX_ACTION_LOG_ROWS;
  const oldest = await prisma.modocActionLog.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: toRemove,
    select: { id: true },
  });
  if (oldest.length > 0) {
    await prisma.modocActionLog.deleteMany({ where: { id: { in: oldest.map((r) => r.id) } } });
  }
}

export async function getRecentActionLogs(
  userId: string,
  limit = MAX_ACTION_LOG_IN_PROMPT,
): Promise<ModocRecentAction[]> {
  const rows = await prisma.modocActionLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toRecentAction);
}

export async function incrementTopicStats(userId: string, topics: string[]): Promise<void> {
  if (topics.length === 0) return;

  await prisma.$transaction(
    topics.map((topic) =>
      prisma.modocTopicStat.upsert({
        where: { userId_topic: { userId, topic } },
        create: { userId, topic, count: 1 },
        update: { count: { increment: 1 } },
      }),
    ),
  );

  const count = await prisma.modocTopicStat.count({ where: { userId } });
  if (count <= MAX_TOPIC_STATS) return;

  const excess = count - MAX_TOPIC_STATS;
  const lowest = await prisma.modocTopicStat.findMany({
    where: { userId },
    orderBy: [{ count: "asc" }, { updatedAt: "asc" }],
    take: excess,
    select: { id: true },
  });
  if (lowest.length > 0) {
    await prisma.modocTopicStat.deleteMany({ where: { id: { in: lowest.map((r) => r.id) } } });
  }
}

export async function getTopTopicStats(
  userId: string,
  limit = MAX_TOPIC_STATS_IN_PROMPT,
): Promise<Record<string, number>> {
  const rows = await prisma.modocTopicStat.findMany({
    where: { userId },
    orderBy: { count: "desc" },
    take: limit,
    select: { topic: true, count: true },
  });
  return Object.fromEntries(rows.map((r) => [r.topic, r.count]));
}

export async function getTopicStatCount(userId: string): Promise<number> {
  return prisma.modocTopicStat.count({ where: { userId } });
}
