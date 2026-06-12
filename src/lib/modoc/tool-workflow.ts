import type { ModocActionType } from "./action-types";
import { ALL_PROJECT_TOOLS, type ProjectPhase, type ProjectToolMeta } from "@/lib/project-tools";

export type ToolWorkflowStep = {
  tool: string;
  label: string;
  phase: ProjectPhase;
  /** Primary next tool in the production pipeline (may skip parallel tools). */
  nextTool?: string;
  nextLabel?: string;
  /** VA actions commonly used to finish or extend work in this tool. */
  assistActions: ModocActionType[];
  /** VA action to escalate to the next pipeline step. */
  escalateAction?: ModocActionType;
  escalatePrompt?: string;
};

function meta(slug: string): ProjectToolMeta | undefined {
  return ALL_PROJECT_TOOLS.find((t) => t.toolSlug === slug);
}

function step(
  slug: string,
  nextSlug: string | undefined,
  assistActions: ModocActionType[],
  escalate?: { action: ModocActionType; prompt: string },
): ToolWorkflowStep {
  const m = meta(slug);
  const next = nextSlug ? meta(nextSlug) : undefined;
  return {
    tool: slug,
    label: m?.label ?? slug.replace(/-/g, " "),
    phase: m?.phase ?? "PRE_PRODUCTION",
    nextTool: nextSlug,
    nextLabel: next?.label,
    assistActions,
    escalateAction: escalate?.action,
    escalatePrompt: escalate?.prompt,
  };
}

/** Creator tool → workflow assist / escalate metadata for proactive VA awareness. */
export const TOOL_WORKFLOW: Record<string, ToolWorkflowStep> = {
  "idea-development": step("idea-development", "script-writing", [
    "update_idea_notes",
    "create_project_idea",
  ], {
    action: "create_project_idea",
    prompt: "refine the idea or start the screenplay",
  }),
  "script-writing": step("script-writing", "script-breakdown", [
    "update_script_content",
    "append_script_content",
    "sync_scenes_from_script",
  ], {
    action: "sync_scenes_from_script",
    prompt: "sync scenes and run a full breakdown",
  }),
  "script-review": step("script-review", "script-breakdown", [], {
    action: "breakdown_full",
    prompt: "run script breakdown after review notes",
  }),
  "script-breakdown": step("script-breakdown", "budget-builder", [
    "breakdown_full",
    "auto_populate_breakdown",
    "incorporate_breakdown_items",
    "sync_scenes_from_script",
    "add_breakdown_location",
  ], {
    action: "generate_smart_budget",
    prompt: "build a smart budget from the breakdown",
  }),
  "budget-builder": step("budget-builder", "production-scheduling", [
    "create_budget",
    "generate_smart_budget",
    "add_budget_line",
    "update_budget_line",
  ], {
    action: "auto_schedule_shoot_days",
    prompt: "plan shoot days on the schedule",
  }),
  "production-scheduling": step("production-scheduling", "casting-portal", [
    "create_shoot_day",
    "auto_schedule_shoot_days",
    "assign_scenes_by_location",
    "assign_scenes_to_shoot_day",
  ], {
    action: "sync_casting_from_breakdown",
    prompt: "sync casting roles from the breakdown",
  }),
  "casting-portal": step("casting-portal", "crew-marketplace", [
    "sync_casting_from_breakdown",
    "create_casting_role",
    "invite_casting_talent",
  ], {
    action: "sync_starter_crew_needs",
    prompt: "define crew needs",
  }),
  "crew-marketplace": step("crew-marketplace", "location-marketplace", [
    "create_crew_need",
    "sync_starter_crew_needs",
    "invite_crew_team",
  ], {
    action: "add_breakdown_location",
    prompt: "scout locations from breakdown needs",
  }),
  "location-marketplace": step("location-marketplace", "equipment-planning", [
    "add_breakdown_location",
    "link_location_to_marketplace",
    "book_location",
  ], {
    action: "add_equipment_plan_item",
    prompt: "plan equipment packages",
  }),
  "equipment-planning": step("equipment-planning", "legal-contracts", [
    "add_equipment_plan_item",
    "request_equipment",
  ], {
    action: "create_contract",
    prompt: "draft location/crew contracts",
  }),
  "legal-contracts": step("legal-contracts", "production-readiness", [
    "create_contract",
    "send_contract",
    "update_contract",
  ], {
    action: "populate_risk_checklist",
    prompt: "complete risk & insurance checklist",
  }),
  "funding-hub": step("funding-hub", "budget-builder", ["update_funding_details"], {
    action: "generate_smart_budget",
    prompt: "align the budget with funding targets",
  }),
  "table-reads": step("table-reads", "script-breakdown", [
    "create_table_read_session",
    "update_table_read_session",
  ], {
    action: "breakdown_full",
    prompt: "refresh the breakdown after table read notes",
  }),
  "visual-planning": step("visual-planning", "script-breakdown", [
    "create_visual_asset",
  ], {
    action: "breakdown_full",
    prompt: "tie visuals to breakdown elements",
  }),
  "production-workspace": step("production-workspace", "production-readiness", [
    "create_project_task",
    "sync_production_workspace_tasks",
    "complete_project_task",
  ], {
    action: "move_to_production",
    prompt: "move the project to production",
  }),
  "risk-insurance": step("risk-insurance", "production-readiness", [
    "add_risk_checklist_item",
    "populate_risk_checklist",
  ], {
    action: "move_to_production",
    prompt: "check production readiness",
  }),
  "production-readiness": step("production-readiness", "control-center", [
    "move_to_production",
    "create_starter_tasks",
  ], {
    action: "move_to_production",
    prompt: "move to production and open the control center",
  }),
  "control-center": step("control-center", "call-sheet-generator", [
    "create_project_task",
    "create_calendar_event",
    "sync_production_workspace_tasks",
  ], {
    action: "generate_call_sheet",
    prompt: "generate call sheets for shoot days",
  }),
  "call-sheet-generator": step("call-sheet-generator", "on-set-tasks", ["generate_call_sheet"], {
    action: "create_starter_tasks",
    prompt: "create on-set task lists",
  }),
  "on-set-tasks": step("on-set-tasks", "shoot-progress", [
    "create_project_task",
    "complete_project_task",
    "sync_production_workspace_tasks",
  ], {
    action: "update_shoot_progress",
    prompt: "track shoot progress by scene",
  }),
  "equipment-tracking": step("equipment-tracking", "shoot-progress", [
    "update_equipment_plan_item",
    "request_equipment",
  ]),
  "shoot-progress": step("shoot-progress", "dailies-review", ["update_shoot_progress"], {
    action: "create_dailies_batch",
    prompt: "log dailies batches",
  }),
  "continuity-manager": step("continuity-manager", "dailies-review", [
    "add_continuity_note",
    "update_continuity_note",
  ]),
  "dailies-review": step("dailies-review", "expense-tracker", [
    "create_dailies_batch",
    "add_dailies_note",
  ], {
    action: "create_production_expense",
    prompt: "capture expenses from the shoot day",
  }),
  "expense-tracker": step("expense-tracker", "wrap", [
    "create_production_expense",
    "update_production_expense",
  ], {
    action: "move_to_production",
    prompt: "wrap production and hand off to post",
  }),
  "incident-reporting": step("incident-reporting", "control-center", [
    "create_incident_report",
    "resolve_incident_report",
  ]),
  "on-set-catering": step("on-set-catering", "on-set-tasks", []),
  wrap: step("wrap", "footage-ingestion", ["move_to_production", "update_project_phase"], {
    action: "create_footage_asset",
    prompt: "ingest footage for post-production",
  }),
  "footage-ingestion": step("footage-ingestion", "editing-studio", [
    "create_footage_asset",
  ], {
    action: "create_post_review",
    prompt: "start an editing review session",
  }),
  "editing-studio": step("editing-studio", "sound-design", [
    "create_post_review",
    "add_post_review_note",
    "update_post_review",
  ], {
    action: "add_music_selection",
    prompt: "move to music & scoring",
  }),
  "sound-design": step("sound-design", "music-scoring", []),
  "music-scoring": step("music-scoring", "final-sound-mix", ["add_music_selection"]),
  "visual-effects": step("visual-effects", "color-grading", []),
  "color-grading": step("color-grading", "final-cut-approval", []),
  "final-sound-mix": step("final-sound-mix", "final-cut-approval", []),
  "final-cut-approval": step("final-cut-approval", "distribution", [
    "update_post_review",
    "create_post_review",
  ], {
    action: "submit_distribution",
    prompt: "submit for distribution",
  }),
  "film-packaging": step("film-packaging", "distribution", ["submit_distribution"]),
  distribution: step("distribution", undefined, ["submit_distribution"]),
};

/** Map VA action types back to the primary tool they mutate. */
export const ACTION_PRIMARY_TOOL: Partial<Record<ModocActionType, string>> = {
  update_idea_notes: "idea-development",
  create_project_idea: "idea-development",
  delete_project_idea: "idea-development",
  update_script_content: "script-writing",
  append_script_content: "script-writing",
  sync_scenes_from_script: "script-breakdown",
  breakdown_full: "script-breakdown",
  breakdown_scenes: "script-breakdown",
  auto_populate_breakdown: "script-breakdown",
  incorporate_breakdown_items: "script-breakdown",
  add_breakdown_location: "location-marketplace",
  update_breakdown_location: "location-marketplace",
  delete_breakdown_location: "location-marketplace",
  create_budget: "budget-builder",
  generate_budget_from_breakdown: "budget-builder",
  generate_smart_budget: "budget-builder",
  add_budget_line: "budget-builder",
  update_budget_line: "budget-builder",
  delete_budget_line: "budget-builder",
  create_shoot_day: "production-scheduling",
  auto_schedule_shoot_days: "production-scheduling",
  update_shoot_day: "production-scheduling",
  delete_shoot_day: "production-scheduling",
  assign_scenes_by_location: "production-scheduling",
  assign_scenes_to_shoot_day: "production-scheduling",
  sync_casting_from_breakdown: "casting-portal",
  create_casting_role: "casting-portal",
  update_casting_role: "casting-portal",
  delete_casting_role: "casting-portal",
  invite_casting_talent: "casting-portal",
  create_crew_need: "crew-marketplace",
  update_crew_need: "crew-marketplace",
  delete_crew_need: "crew-marketplace",
  sync_starter_crew_needs: "crew-marketplace",
  invite_crew_team: "crew-marketplace",
  link_location_to_marketplace: "location-marketplace",
  book_location: "location-marketplace",
  add_equipment_plan_item: "equipment-planning",
  update_equipment_plan_item: "equipment-planning",
  delete_equipment_plan_item: "equipment-planning",
  request_equipment: "equipment-planning",
  create_contract: "legal-contracts",
  send_contract: "legal-contracts",
  update_contract: "legal-contracts",
  delete_contract: "legal-contracts",
  update_funding_details: "funding-hub",
  create_table_read_session: "table-reads",
  update_table_read_session: "table-reads",
  delete_table_read_session: "table-reads",
  create_visual_asset: "visual-planning",
  delete_visual_asset: "visual-planning",
  add_risk_checklist_item: "risk-insurance",
  update_risk_checklist_item: "risk-insurance",
  delete_risk_checklist_item: "risk-insurance",
  populate_risk_checklist: "risk-insurance",
  move_to_production: "production-readiness",
  update_project_phase: "wrap",
  create_project_task: "production-workspace",
  update_project_task: "production-workspace",
  delete_project_task: "production-workspace",
  complete_project_task: "production-workspace",
  create_starter_tasks: "production-workspace",
  sync_production_workspace_tasks: "production-workspace",
  create_calendar_event: "control-center",
  create_team_calendar_event: "control-center",
  update_calendar_event: "control-center",
  delete_calendar_event: "control-center",
  generate_call_sheet: "call-sheet-generator",
  update_shoot_progress: "shoot-progress",
  add_continuity_note: "continuity-manager",
  update_continuity_note: "continuity-manager",
  delete_continuity_note: "continuity-manager",
  create_dailies_batch: "dailies-review",
  add_dailies_note: "dailies-review",
  delete_dailies_batch: "dailies-review",
  create_production_expense: "expense-tracker",
  update_production_expense: "expense-tracker",
  delete_production_expense: "expense-tracker",
  create_incident_report: "incident-reporting",
  update_incident_report: "incident-reporting",
  resolve_incident_report: "incident-reporting",
  delete_incident_report: "incident-reporting",
  create_footage_asset: "footage-ingestion",
  delete_footage_asset: "footage-ingestion",
  add_music_selection: "music-scoring",
  delete_music_selection: "music-scoring",
  create_post_review: "editing-studio",
  add_post_review_note: "editing-studio",
  update_post_review: "editing-studio",
  delete_post_review: "editing-studio",
  submit_distribution: "distribution",
};

export function workflowForTool(tool: string): ToolWorkflowStep | undefined {
  return TOOL_WORKFLOW[tool];
}

export function toolForVaAction(action: string): string | undefined {
  return ACTION_PRIMARY_TOOL[action as ModocActionType];
}

export function projectToolPath(
  projectId: string,
  phase: ProjectPhase,
  toolSlug: string,
): string {
  const segment =
    phase === "PRE_PRODUCTION"
      ? "pre-production"
      : phase === "PRODUCTION"
        ? "production"
        : "post-production";
  return `/creator/projects/${projectId}/${segment}/${toolSlug}`;
}
