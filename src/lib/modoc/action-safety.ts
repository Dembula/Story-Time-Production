import "server-only";

import type { ModocActionType } from "./action-types";
import type { ProductionGraph } from "./production-graph";
import { isDestructiveModocAction } from "./production-graph";
import { getRecentActionLogs } from "./learning-store";

export type ActionSafetyResult =
  | { mode: "execute"; action: ModocActionType; payload: Record<string, unknown> }
  | { mode: "suggest"; action: ModocActionType; payload: Record<string, unknown>; reason: string }
  | { mode: "block"; reason: string };

const DEPENDENCY_RULES: Partial<
  Record<ModocActionType, { requires: Array<keyof ProductionGraph["stats"]>; min?: number; message: string }[]>
> = {
  breakdown_full: [
    { requires: ["hasScript"], message: "Script required before full breakdown" },
  ],
  auto_populate_breakdown: [
    { requires: ["hasScript"], message: "Script required before breakdown" },
  ],
  sync_scenes_from_script: [
    { requires: ["hasScript"], message: "Script required to sync scenes" },
  ],
  generate_smart_budget: [
    { requires: ["characterCount"], min: 1, message: "Breakdown characters required before smart budget" },
  ],
  generate_budget_from_breakdown: [
    { requires: ["characterCount"], min: 1, message: "Breakdown required before budget generation" },
  ],
  auto_schedule_shoot_days: [
    { requires: ["budgetLineCount"], min: 1, message: "Budget lines recommended before scheduling shoot days" },
  ],
  generate_call_sheet: [
    { requires: ["shootDayCount"], min: 1, message: "Shoot day required for call sheet" },
  ],
  sync_casting_from_breakdown: [
    { requires: ["characterCount"], min: 1, message: "Breakdown characters required for casting sync" },
  ],
};

const DUPLICATE_WINDOW_MS = 90_000;

/** Validate action against production graph, dependencies, and recent duplicates. */
export async function validateModocActionSafety(params: {
  userId: string;
  action: ModocActionType;
  payload: Record<string, unknown>;
  graph: ProductionGraph | null;
  confirmDestructive?: boolean;
}): Promise<ActionSafetyResult> {
  const { action, payload, graph, confirmDestructive } = params;
  const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;

  if (!projectId) {
    return { mode: "block", reason: "projectId is required in context before executing actions" };
  }

  if (graph && graph.projectId !== projectId) {
    return { mode: "block", reason: "projectId does not match focus project graph" };
  }

  if (isDestructiveModocAction(action) && !confirmDestructive) {
    return {
      mode: "suggest",
      action,
      payload,
      reason: "Destructive action requires explicit user confirmation — emit MODOC_SUGGEST first",
    };
  }

  const rules = DEPENDENCY_RULES[action];
  if (rules && graph) {
    for (const rule of rules) {
      for (const key of rule.requires) {
        const min = rule.min ?? 1;
        if (key === "hasScript") {
          if (!graph.stats.hasScript) {
            return { mode: "suggest", action, payload, reason: rule.message };
          }
          continue;
        }
        const val = graph.stats[key];
        if (typeof val === "number" && val < min) {
          return { mode: "suggest", action, payload, reason: rule.message };
        }
      }
    }
  }

  const recent = await getRecentActionLogs(params.userId, 5).catch(() => []);
  const dup = recent.find(
    (l) =>
      l.action === action &&
      l.ok !== false &&
      l.payload?.projectId === projectId &&
      Date.now() - new Date(l.at).getTime() < DUPLICATE_WINDOW_MS,
  );
  if (dup) {
    return {
      mode: "suggest",
      action,
      payload,
      reason: `Same action "${action}" ran recently — confirm redo if intended`,
    };
  }

  return { mode: "execute", action, payload };
}
