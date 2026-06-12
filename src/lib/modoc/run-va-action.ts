import "server-only";

import { executeModocAction } from "@/lib/modoc/actions";
import { recordModocActionExecution, recordModocActionFeedback } from "@/lib/modoc/learning";
import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";
import type { ModocActionResult } from "@/lib/modoc/actions";
import { validateModocActionSafety } from "@/lib/modoc/action-safety";
import { buildProductionGraph } from "@/lib/modoc/production-graph";
import { suggestProductionReadiness } from "@/lib/modoc/proactive";

const READINESS_TRIGGER_ACTIONS = new Set([
  "generate_budget_from_breakdown",
  "generate_smart_budget",
  "create_budget",
  "add_budget_line",
  "create_shoot_day",
  "auto_schedule_shoot_days",
]);

export async function runVaAction(params: {
  userId: string;
  action: ModocActionType;
  payload?: ModocActionPayload;
  conversationId?: string;
  confirmDestructive?: boolean;
}): Promise<ModocActionResult> {
  const payload = params.payload ?? {};
  const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;

  const graph =
    projectId != null ? await buildProductionGraph(params.userId, projectId).catch(() => null) : null;

  const safety = await validateModocActionSafety({
    userId: params.userId,
    action: params.action,
    payload: payload as Record<string, unknown>,
    graph,
    confirmDestructive: params.confirmDestructive,
  });

  if (safety.mode === "block") {
    return { ok: false, error: safety.reason, status: 400 };
  }

  if (safety.mode === "suggest") {
    return {
      ok: false,
      error: safety.reason,
      status: 409,
      data: {
        suggest: true,
        action: safety.action,
        payload: safety.payload,
        reason: safety.reason,
      },
    };
  }

  const result = await executeModocAction(params.userId, safety.action, safety.payload as ModocActionPayload);

  void recordModocActionFeedback(params.userId, params.action, result.ok);
  void recordModocActionExecution(params.userId, {
    at: new Date().toISOString(),
    action: params.action,
    payload: payload as Record<string, unknown>,
    ok: result.ok,
    message: result.ok ? result.message : result.error,
    eventId:
      result.ok && result.data?.eventId ? String(result.data.eventId) : undefined,
    taskIds:
      result.ok && Array.isArray(result.data?.taskIds)
        ? (result.data.taskIds as string[])
        : undefined,
    conversationId: params.conversationId,
  });

  if (result.ok && projectId && READINESS_TRIGGER_ACTIONS.has(params.action)) {
    void suggestProductionReadiness({ userId: params.userId, projectId });
  }

  return result;
}

export function buildExecutedActionPromptBlock(
  actionType: string,
  result: ModocActionResult,
  context: "suggestion" | "follow_up" | "chat",
): string {
  const intro =
    context === "follow_up"
      ? "The user asked you to redo or restore something in an ongoing conversation."
      : context === "suggestion"
        ? "The user accepted a suggested task from the Virtual Assistant panel."
        : "You ran an action the user requested in chat.";

  if (!result.ok && result.status === 409 && result.data?.suggest) {
    return `

## Action safety (suggest instead of execute)
The platform blocked automatic execution of "${actionType}".
Reason: ${result.error}
Emit MODOC_SUGGEST with the same type and explain the blocker in OBSERVATION/REASONING. Ask for confirmation or missing prerequisite.`;
  }

  return `

## Confirmed VA task (already executed)
${intro} You already ran "${actionType}" on their behalf.
Outcome: ${result.ok ? result.message : `Failed: ${result.error}`}
Respond using OBSERVATION / REASONING / ACTION protocol. Summarize what changed in the graph and one next step.
Continue naturally — do NOT re-emit MODOC_ACTION unless they ask for something new.`;
}
