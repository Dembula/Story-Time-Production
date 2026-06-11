import "server-only";

import { executeModocAction } from "@/lib/modoc/actions";
import { recordModocActionExecution, recordModocActionFeedback } from "@/lib/modoc/learning";
import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";
import type { ModocActionResult } from "@/lib/modoc/actions";

export async function runVaAction(params: {
  userId: string;
  action: ModocActionType;
  payload?: ModocActionPayload;
  conversationId?: string;
}): Promise<ModocActionResult> {
  const payload = params.payload ?? {};
  const result = await executeModocAction(params.userId, params.action, payload);

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

  return `

## Confirmed VA task (already executed)
${intro} You already ran "${actionType}" on their behalf.
Outcome: ${result.ok ? result.message : `Failed: ${result.error}`}
Respond in 2–4 warm, concise sentences summarizing what was done, what changed, and one sensible next step.
Continue the conversation naturally — the user may ask follow-up questions or request edits.
Do NOT include a MODOC_ACTION line — the work is already complete unless they ask for something new.`;
}
