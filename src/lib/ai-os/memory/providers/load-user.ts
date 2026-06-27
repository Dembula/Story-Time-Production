import "server-only";

import { getModocLearning } from "@/lib/modoc/learning";
import {
  getLatestSessionIntel,
  getRecentActionLogs,
  getTopPlaybookRules,
  getTopTopicStats,
} from "@/lib/modoc/learning-store";
import { MAX_TOPIC_STATS_IN_PROMPT } from "@/lib/modoc/learning-limits";
import type { UserMemory } from "../types";

function computeActionSuccessRates(
  logs: Array<{ action: string; ok?: boolean }>,
): Record<string, number> {
  const buckets: Record<string, { ok: number; total: number }> = {};
  for (const log of logs) {
    const b = buckets[log.action] ?? { ok: 0, total: 0 };
    b.total += 1;
    if (log.ok !== false) b.ok += 1;
    buckets[log.action] = b;
  }
  const rates: Record<string, number> = {};
  for (const [action, { ok, total }] of Object.entries(buckets)) {
    rates[action] = total > 0 ? ok / total : 0;
  }
  return rates;
}

export async function loadUserMemory(params: {
  userId: string;
  projectId?: string | null;
}): Promise<UserMemory> {
  const [learning, recentLogs, playbookRules, sessionIntel, topicStats] = await Promise.all([
    getModocLearning(params.userId),
    getRecentActionLogs(params.userId, 25).catch(() => []),
    getTopPlaybookRules(params.userId, 8).catch(() => []),
    getLatestSessionIntel(params.userId, params.projectId).catch(() => null),
    getTopTopicStats(params.userId, MAX_TOPIC_STATS_IN_PROMPT).catch(() => []),
  ]);

  const intelSnapshot =
    sessionIntel ??
    (learning.lastSessionIntel
      ? {
          next_best_action_priority: learning.lastSessionIntel.next_best_action_priority,
          next_best_action_score: learning.lastSessionIntel.next_best_action_score,
          missing_context_flags: learning.lastSessionIntel.missing_context_flags,
          action_success_rate_estimate: learning.lastSessionIntel.action_success_rate_estimate,
          suggestion_acceptance_rate: learning.lastSessionIntel.suggestion_acceptance_rate,
        }
      : undefined);

  return {
    acceptedActions: learning.acceptedActions ?? {},
    declinedActions: learning.declinedActions ?? {},
    preferredSuggestions: learning.preferredSuggestions ?? [],
    actionSuccessRates: computeActionSuccessRates(recentLogs),
    recentActions: recentLogs.slice(0, 8).map((l) => `${l.action}:${l.ok === false ? "fail" : "ok"}`),
    topTopics: Object.entries(topicStats).map(([topic, count]) => ({ topic, count })),
    playbookRules: playbookRules.map((r) => ({
      when: r.when,
      then: r.then,
      confidence: r.confidence,
    })),
    interactionCount: learning.interactionCount,
    ...(intelSnapshot
      ? {
          lastSessionIntel: {
            next_best_action_priority: intelSnapshot.next_best_action_priority,
            next_best_action_score: intelSnapshot.next_best_action_score,
            missing_context_flags: intelSnapshot.missing_context_flags,
            action_success_rate_estimate: intelSnapshot.action_success_rate_estimate,
            suggestion_acceptance_rate: intelSnapshot.suggestion_acceptance_rate,
          },
        }
      : {}),
  };
}
