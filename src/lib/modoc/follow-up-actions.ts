import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocRecentAction } from "./learning";

const REDO_PATTERN =
  /\b(redo|recreate|re-create|create again|do it again|do that again|restore|put it back|add it back|bring it back|i deleted|deleted it|deleted by mistake|by mistake|accidentally deleted|remove by mistake)\b/i;

const DELETE_PATTERN =
  /\b(delete|remove|cancel|clear|take off|get rid of)\b/i;

const CALENDAR_HINT =
  /\b(event|calendar|planning|session|meeting|sync|appointment|week|june|july|august|september|october|november|december|january|february|march|april|may|\d{1,2}(st|nd|rd|th)?)\b/i;

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

  const reversed = [...recentActions].reverse();

  if (DELETE_PATTERN.test(text) && CALENDAR_HINT.test(text)) {
    const calendarAction = reversed.find(
      (a) =>
        a.action === "create_calendar_event" ||
        a.action === "create_team_calendar_event",
    );
    if (calendarAction) {
      const p = payloadFromRecent(calendarAction);
      if (p.eventId || (p.title && (p.startAt || p.date || p.dueDate))) {
        return {
          type: "delete_calendar_event",
          payload: {
            eventId: p.eventId as string | undefined,
            title: p.title,
            startAt: p.startAt ?? p.date ?? p.dueDate,
          },
        };
      }
    }
  }

  if (DELETE_PATTERN.test(text) && /\b(task|tasks|to-do|todo)\b/i.test(text)) {
    const taskAction = reversed.find(
      (a) => a.action === "create_project_task" || a.action === "create_starter_tasks",
    );
    if (taskAction && taskAction.action === "create_project_task") {
      const p = payloadFromRecent(taskAction);
      return {
        type: "delete_project_task",
        payload: {
          projectId: p.projectId,
          taskId: p.taskId as string | undefined,
          title: p.title,
        },
      };
    }
  }

  if (!REDO_PATTERN.test(text)) return null;

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

  if (/\b(budget|breakdown|script|scenes?|characters?)\b/i.test(text)) {
    const breakdown = reversed.find(
      (a) =>
        a.action === "breakdown_full" ||
        a.action === "breakdown_scenes" ||
        a.action === "sync_scenes_from_script" ||
        a.action === "generate_budget_from_breakdown" ||
        a.action === "generate_smart_budget" ||
        a.action === "create_budget",
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
