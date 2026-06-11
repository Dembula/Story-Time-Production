import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocRecentAction } from "./learning";

const REDO_PATTERN =
  /\b(redo|recreate|re-create|create again|do it again|do that again|restore|put it back|add it back|bring it back|i deleted|deleted it|deleted by mistake|by mistake|accidentally deleted|remove by mistake)\b/i;

const CALENDAR_HINT =
  /\b(event|calendar|planning|session|meeting|sync|appointment|week)\b/i;

function payloadFromRecent(action: ModocRecentAction): ModocActionPayload {
  return (action.payload ?? {}) as ModocActionPayload;
}

/** Infer a concrete VA action when the user asks to redo or restore something from chat. */
export function inferFollowUpExecuteAction(
  userText: string,
  recentActions: ModocRecentAction[],
): { type: ModocActionType; payload: ModocActionPayload } | null {
  const text = userText.trim();
  if (!text || recentActions.length === 0) return null;
  if (!REDO_PATTERN.test(text)) return null;

  const reversed = [...recentActions].reverse();

  if (CALENDAR_HINT.test(text)) {
    const calendarAction = reversed.find(
      (a) => a.action === "create_calendar_event" || a.action === "create_team_calendar_event",
    );
    if (calendarAction) {
      return {
        type: calendarAction.action as ModocActionType,
        payload: payloadFromRecent(calendarAction),
      };
    }
  }

  if (/\b(breakdown|script|scenes?|characters?)\b/i.test(text)) {
    const breakdown = reversed.find(
      (a) =>
        a.action === "breakdown_full" ||
        a.action === "breakdown_scenes" ||
        a.action === "sync_scenes_from_script",
    );
    if (breakdown) {
      return { type: breakdown.action as ModocActionType, payload: payloadFromRecent(breakdown) };
    }
  }

  if (/\b(task|tasks|to-do|todo)\b/i.test(text)) {
    const taskAction = reversed.find(
      (a) => a.action === "create_starter_tasks" || a.action === "create_project_task",
    );
    if (taskAction) {
      return { type: taskAction.action as ModocActionType, payload: payloadFromRecent(taskAction) };
    }
  }

  const last = reversed[0];
  if (last) {
    return { type: last.action as ModocActionType, payload: payloadFromRecent(last) };
  }

  return null;
}
