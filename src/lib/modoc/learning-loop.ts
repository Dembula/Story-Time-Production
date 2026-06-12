import "server-only";

import type { ModocIntelBlock } from "./response-protocol";
import type { ModocLearningProfile } from "./learning";
import { getModocLearning, saveModocLearning } from "./learning";
import { appendSessionIntel, getRecentActionLogs } from "./learning-store";
import type { ProductionGraph } from "./production-graph";
import { scoreActionPriority } from "./modoc-memory";
import type { ModocActionType } from "./action-types";

export type ModocSessionIntel = {
  at: string;
  userIntent?: string;
  action_success_rate_estimate: number;
  suggestion_acceptance_rate: number;
  missing_context_flags: string[];
  next_best_action_priority: string | null;
  next_best_action_score: number;
  modelUsed?: string;
  conversationId?: string;
  projectId?: string;
};

function acceptanceRate(profile: ModocLearningProfile): number {
  const accepted = Object.values(profile.acceptedActions ?? {}).reduce((a, b) => a + b, 0);
  const declined = Object.values(profile.declinedActions ?? {}).reduce((a, b) => a + b, 0);
  if (accepted + declined === 0) return 0.5;
  return accepted / (accepted + declined);
}

function overallSuccessRate(logs: Array<{ ok?: boolean }>): number {
  if (logs.length === 0) return 0.75;
  const ok = logs.filter((l) => l.ok !== false).length;
  return ok / logs.length;
}

/** Compute session intelligence metadata after an interaction. */
export async function buildModocSessionIntel(params: {
  userId: string;
  userIntent?: string;
  graph: ProductionGraph | null;
  intelBlock?: ModocIntelBlock | null;
  modelUsed?: string;
  conversationId?: string;
  projectId?: string | null;
}): Promise<ModocSessionIntel> {
  const [learning, logs] = await Promise.all([
    getModocLearning(params.userId),
    getRecentActionLogs(params.userId, 20).catch(() => []),
  ]);

  const rates: Record<string, number> = {};
  const buckets: Record<string, { ok: number; t: number }> = {};
  for (const log of logs) {
    const b = buckets[log.action] ?? { ok: 0, t: 0 };
    b.t += 1;
    if (log.ok !== false) b.ok += 1;
    buckets[log.action] = b;
  }
  for (const [a, b] of Object.entries(buckets)) {
    rates[a] = b.t > 0 ? b.ok / b.t : 0.7;
  }

  let nextAction: string | null = null;
  let nextScore = 0;
  if (params.graph) {
    for (const signal of params.graph.readiness) {
      if (!signal.satisfied && signal.suggestedAction && signal.confidence >= 0.75) {
        const score =
          signal.confidence *
          scoreActionPriority(signal.suggestedAction as ModocActionType, learning, rates);
        if (score > nextScore) {
          nextScore = score;
          nextAction = signal.suggestedAction;
        }
      }
    }
  }

  if (params.intelBlock?.next_best_action) {
    nextAction = params.intelBlock.next_best_action;
  }

  const missing = [
    ...(params.graph?.missingContextFlags ?? []),
    ...(params.intelBlock?.missing_context_flags ?? []),
  ];

  return {
    at: new Date().toISOString(),
    userIntent: params.userIntent?.slice(0, 500),
    action_success_rate_estimate:
      params.intelBlock?.action_success_rate_estimate ?? overallSuccessRate(logs),
    suggestion_acceptance_rate:
      params.intelBlock?.suggestion_acceptance_rate ?? acceptanceRate(learning),
    missing_context_flags: [...new Set(missing)],
    next_best_action_priority: nextAction,
    next_best_action_score: nextScore,
    modelUsed: params.modelUsed,
    conversationId: params.conversationId,
    projectId: params.projectId ?? undefined,
  };
}

/** Persist session intel to DB + behavioral memory for next-turn adaptation. */
export async function persistModocSessionIntel(
  userId: string,
  intel: ModocSessionIntel,
): Promise<void> {
  await Promise.all([
    appendSessionIntel(userId, intel).catch(() => {}),
    saveModocLearning(userId, {
      lastEvaluatedAt: intel.at,
      lastSessionIntel: {
        at: intel.at,
        next_best_action_priority: intel.next_best_action_priority,
        next_best_action_score: intel.next_best_action_score,
        missing_context_flags: intel.missing_context_flags,
        action_success_rate_estimate: intel.action_success_rate_estimate,
        suggestion_acceptance_rate: intel.suggestion_acceptance_rate,
        modelUsed: intel.modelUsed,
      },
    }),
  ]);
}
