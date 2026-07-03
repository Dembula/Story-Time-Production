import type { ModocActionType } from "./action-types";

/**
 * Pipeline cascade keys: mutating an upstream stage must refresh every
 * downstream consumer, otherwise tools show stale data until manual reload.
 */
const BREAKDOWN_CASCADE = [
  "project-breakdown",
  "project-scenes",
  "project-casting",
  "project-schedule",
  "project-budget",
  "project-breakdown-intelligence",
];
const SCHEDULE_CASCADE = [
  "project-schedule",
  "project-shoot-progress",
  "project-call-sheets",
  "project-budget",
  "production-control-center",
  "command-center-calendar",
];
const CASTING_CASCADE = ["project-casting", "project-schedule", "project-budget"];
const CREW_CASCADE = ["project-crew", "project-schedule", "project-budget"];

/** React Query keys to invalidate when a VA action mutates creator data. */
const ACTION_QUERY_KEYS: Partial<Record<ModocActionType, string[]>> = {
  update_idea_notes: ["project-ideas", "creator-ideas"],
  create_project_idea: ["project-ideas", "creator-ideas"],
  delete_project_idea: ["project-ideas", "creator-ideas"],
  update_script_content: ["project-script"],
  append_script_content: ["project-script"],
  create_calendar_event: ["command-center-calendar"],
  create_team_calendar_event: ["command-center-calendar"],
  update_calendar_event: ["command-center-calendar"],
  delete_calendar_event: ["command-center-calendar"],
  create_project_task: ["project-tasks", "command-center-calendar"],
  update_project_task: ["project-tasks", "command-center-calendar"],
  delete_project_task: ["project-tasks", "command-center-calendar"],
  complete_project_task: ["project-tasks", "command-center-calendar"],
  create_starter_tasks: ["project-tasks"],
  sync_production_workspace_tasks: ["project-tasks"],
  create_budget: ["project-budget"],
  generate_smart_budget: ["project-budget"],
  generate_budget_from_breakdown: ["project-budget"],
  add_budget_line: ["project-budget"],
  update_budget_line: ["project-budget"],
  delete_budget_line: ["project-budget"],
  create_shoot_day: SCHEDULE_CASCADE,
  auto_schedule_shoot_days: SCHEDULE_CASCADE,
  update_shoot_day: SCHEDULE_CASCADE,
  delete_shoot_day: SCHEDULE_CASCADE,
  assign_scenes_by_location: [...SCHEDULE_CASCADE, "project-breakdown"],
  assign_scenes_to_shoot_day: SCHEDULE_CASCADE,
  sync_casting_from_breakdown: CASTING_CASCADE,
  create_casting_role: CASTING_CASCADE,
  update_casting_role: CASTING_CASCADE,
  delete_casting_role: CASTING_CASCADE,
  create_crew_need: CREW_CASCADE,
  update_crew_need: CREW_CASCADE,
  delete_crew_need: CREW_CASCADE,
  sync_starter_crew_needs: CREW_CASCADE,
  add_breakdown_location: ["project-breakdown"],
  update_breakdown_location: ["project-breakdown"],
  delete_breakdown_location: ["project-breakdown"],
  add_equipment_plan_item: ["project-equipment"],
  update_equipment_plan_item: ["project-equipment"],
  delete_equipment_plan_item: ["project-equipment"],
  breakdown_full: BREAKDOWN_CASCADE,
  breakdown_scenes: ["project-breakdown", "project-scenes"],
  auto_populate_breakdown: BREAKDOWN_CASCADE,
  sync_scenes_from_script: [...BREAKDOWN_CASCADE, "project-script"],
  create_production_expense: ["project-expenses"],
  update_production_expense: ["project-expenses"],
  delete_production_expense: ["project-expenses"],
  create_incident_report: ["project-incidents", "command-center-calendar"],
  update_incident_report: ["project-incidents"],
  resolve_incident_report: ["project-incidents"],
  delete_incident_report: ["project-incidents"],
  add_continuity_note: ["project-continuity"],
  update_continuity_note: ["project-continuity"],
  delete_continuity_note: ["project-continuity"],
  create_dailies_batch: ["project-dailies", "project-dailies-intelligence"],
  delete_dailies_batch: ["project-dailies", "project-dailies-intelligence"],
  add_risk_checklist_item: ["project-risk"],
  update_risk_checklist_item: ["project-risk"],
  delete_risk_checklist_item: ["project-risk"],
  populate_risk_checklist: ["project-risk"],
  create_table_read_session: ["project-table-reads", "command-center-calendar"],
  update_table_read_session: ["project-table-reads"],
  delete_table_read_session: ["project-table-reads"],
  create_visual_asset: ["project-visual-assets"],
  delete_visual_asset: ["project-visual-assets"],
  add_music_selection: ["project-music"],
  delete_music_selection: ["project-music"],
  create_footage_asset: ["project-footage"],
  delete_footage_asset: ["project-footage"],
  submit_distribution: ["project-distribution"],
  move_to_production: ["creator-command-center", "project-status"],
  update_project_phase: ["creator-command-center", "project-status"],
  update_funding_details: ["project-funding"],
  incorporate_breakdown_items: ["project-breakdown"],
  create_contract: ["project-contracts"],
  send_contract: ["project-contracts"],
  update_contract: ["project-contracts"],
  delete_contract: ["project-contracts"],
  create_post_review: ["project-reviews"],
  add_post_review_note: ["project-reviews"],
  update_post_review: ["project-reviews"],
  delete_post_review: ["project-reviews"],
};

export const CALENDAR_RELATED_ACTIONS = new Set<ModocActionType>([
  "create_calendar_event",
  "create_team_calendar_event",
  "update_calendar_event",
  "delete_calendar_event",
  "create_project_task",
  "update_project_task",
  "delete_project_task",
  "complete_project_task",
  "create_shoot_day",
  "auto_schedule_shoot_days",
  "update_shoot_day",
  "delete_shoot_day",
  "create_table_read_session",
  "create_incident_report",
]);

export function queryKeysForModocAction(action: string): string[] {
  return ACTION_QUERY_KEYS[action as ModocActionType] ?? ["creator-command-center"];
}

export type ModocFieldFillDetail = {
  tool: string;
  projectId?: string;
  fields: Record<string, string>;
};

export function notifyModocToolsChanged(
  action: string,
  _options?: { projectId?: string; resultMessage?: string },
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("modoc:tools-changed", {
      detail: { action, queryKeys: queryKeysForModocAction(action) },
    }),
  );
}

/** @deprecated use notifyModocToolsChanged */
export function notifyCommandCenterCalendarChanged() {
  notifyModocToolsChanged("create_calendar_event");
}

export function notifyModocFieldFill(detail: ModocFieldFillDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("modoc:field-fill", { detail }));
}
