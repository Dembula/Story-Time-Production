/** Notify Command Center calendar to refetch after VA creates/edits/deletes calendar data. */
export function notifyCommandCenterCalendarChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("modoc:calendar-changed"));
}

export const CALENDAR_RELATED_ACTIONS = new Set([
  "create_calendar_event",
  "create_team_calendar_event",
  "update_calendar_event",
  "delete_calendar_event",
  "create_project_task",
  "update_project_task",
  "delete_project_task",
  "complete_project_task",
]);
