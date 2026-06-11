export type ModocActionType =
  | "breakdown_full"
  | "breakdown_scenes"
  | "sync_scenes_from_script"
  | "create_calendar_event"
  | "create_team_calendar_event"
  | "create_project_task"
  | "create_starter_tasks"
  | "move_to_production";

export type ModocActionPayload = {
  projectId?: string;
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  department?: string;
  priority?: string;
  assigneeId?: string;
};

/** Parse MODOC_ACTION lines from assistant text */
export function parseModocActionFromText(text: string): {
  action: ModocActionType;
  payload: ModocActionPayload;
} | null {
  const match = text.match(/MODOC_ACTION:\s*(\{[\s\S]*?\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { type?: string } & ModocActionPayload;
    if (!parsed.type) return null;
    const action = parsed.type as ModocActionType;
    const { type: _t, ...payload } = parsed;
    return { action, payload };
  } catch {
    return null;
  }
}
