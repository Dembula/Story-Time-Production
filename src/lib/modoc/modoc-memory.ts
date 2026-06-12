import "server-only";

import type { ProductionGraph } from "./production-graph";
import { formatProductionGraphForPrompt } from "./production-graph";
import type { ModocLearningProfile } from "./learning";
import { getModocLearning } from "./learning";
import { getLatestSessionIntel, getRecentActionLogs, getTopPlaybookRules } from "./learning-store";
import { TOOL_WORKFLOW } from "./tool-workflow";
import type { ModocActionType } from "./action-types";

export type ModocMemoryLayers = {
  shortTerm: {
    sessionTool?: string;
    sessionTask?: string;
    recentUserIntents: string[];
    recentActions: string[];
    at: string;
  };
  project: ProductionGraph | null;
  behavioral: {
    acceptedActions: Record<string, number>;
    declinedActions: Record<string, number>;
    preferredSuggestions: string[];
    actionSuccessRates: Record<string, number>;
    lastSessionIntel?: {
      next_best_action_priority: string | null;
      next_best_action_score: number;
      missing_context_flags: string[];
      action_success_rate_estimate: number;
      suggestion_acceptance_rate: number;
    };
  };
  system: {
    workflowPatterns: Array<{ tool: string; nextTool?: string; escalateAction?: string }>;
    playbookRules: Array<{ when: string; then: string; confidence: number }>;
  };
};

export type AssembledModocMemory = {
  layers: ModocMemoryLayers;
  promptBlock: string;
  missingContextFlags: string[];
};

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

/** Assemble 4 structured memory layers for MODOC reasoning. */
export async function assembleModocMemory(params: {
  userId: string;
  projectId?: string | null;
  graph: ProductionGraph | null;
  pageContext?: Record<string, unknown>;
  recentUserMessages?: string[];
}): Promise<AssembledModocMemory> {
  const [learning, recentLogs, playbookRules, sessionIntel] = await Promise.all([
    getModocLearning(params.userId),
    getRecentActionLogs(params.userId, 25).catch(() => []),
    getTopPlaybookRules(params.userId, 8).catch(() => []),
    getLatestSessionIntel(params.userId, params.projectId).catch(() => null),
  ]);

  const shortTerm = {
    sessionTool: typeof params.pageContext?.tool === "string" ? params.pageContext.tool : undefined,
    sessionTask: typeof params.pageContext?.task === "string" ? params.pageContext.task : undefined,
    recentUserIntents: (params.recentUserMessages ?? []).slice(-5),
    recentActions: recentLogs.slice(0, 8).map((l) => `${l.action}:${l.ok === false ? "fail" : "ok"}`),
    at: new Date().toISOString(),
  };

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

  const behavioral = {
    acceptedActions: learning.acceptedActions ?? {},
    declinedActions: learning.declinedActions ?? {},
    preferredSuggestions: learning.preferredSuggestions ?? [],
    actionSuccessRates: computeActionSuccessRates(recentLogs),
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

  const workflowPatterns = Object.values(TOOL_WORKFLOW)
    .slice(0, 20)
    .map((w) => ({
      tool: w.tool,
      nextTool: w.nextTool,
      escalateAction: w.escalateAction,
    }));

  const system = {
    workflowPatterns,
    playbookRules: playbookRules.map((r) => ({
      when: r.when,
      then: r.then,
      confidence: r.confidence,
    })),
  };

  const layers: ModocMemoryLayers = {
    shortTerm,
    project: params.graph,
    behavioral,
    system,
  };

  const missingContextFlags = [
    ...(params.graph?.missingContextFlags ?? []),
    ...(intelSnapshot?.missing_context_flags ?? []),
    ...(!params.projectId ? ["no_focus_project"] : []),
  ];

  const promptBlock = formatMemoryPromptBlock(layers, params.graph);

  return { layers, promptBlock, missingContextFlags };
}

function formatMemoryPromptBlock(layers: ModocMemoryLayers, graph: ProductionGraph | null): string {
  const parts: string[] = [
    "## MODOC memory layers (structured JSON — not chat history)",
    "",
    "### 1. Short-term (current session)",
    "```json",
    JSON.stringify(layers.shortTerm, null, 2),
    "```",
    "",
  ];

  if (graph) {
    parts.push(formatProductionGraphForPrompt(graph), "");
  } else {
    parts.push(
      "### 2. Project memory",
      "No focus project graph loaded. Request projectId from page context before executing project actions.",
      "",
    );
  }

  parts.push(
    "### 3. Behavioral memory",
    "```json",
    JSON.stringify(layers.behavioral, null, 2),
    "```",
    "",
    "### 4. System memory (workflows + playbook)",
    "```json",
    JSON.stringify(layers.system, null, 2),
    "```",
  );

  return parts.join("\n");
}

/** Rank suggested action by behavioral success + acceptance. */
export function scoreActionPriority(
  action: ModocActionType,
  learning: ModocLearningProfile,
  successRates: Record<string, number>,
): number {
  const accepted = learning.acceptedActions?.[action] ?? 0;
  const declined = learning.declinedActions?.[action] ?? 0;
  const rate = successRates[action] ?? 0.7;
  const pref = learning.preferredSuggestions?.includes(action) ? 0.15 : 0;
  const acceptance = accepted + declined > 0 ? accepted / (accepted + declined) : 0.5;
  return rate * 0.5 + acceptance * 0.35 + pref;
}
