export type ModocActionType =
  | "breakdown_full"
  | "breakdown_scenes"
  | "sync_scenes_from_script"
  | "auto_populate_breakdown"
  | "create_calendar_event"
  | "create_team_calendar_event"
  | "create_project_task"
  | "create_starter_tasks"
  | "complete_project_task"
  | "move_to_production"
  | "update_project_phase"
  | "create_budget"
  | "generate_budget_from_breakdown"
  | "generate_smart_budget"
  | "add_budget_line"
  | "create_shoot_day"
  | "auto_schedule_shoot_days"
  | "sync_casting_from_breakdown"
  | "create_casting_role"
  | "create_crew_need"
  | "sync_starter_crew_needs"
  | "add_breakdown_location"
  | "link_location_to_marketplace"
  | "add_equipment_plan_item"
  | "create_production_expense"
  | "update_idea_notes"
  | "create_project_idea"
  | "create_table_read_session"
  | "generate_call_sheet"
  | "add_risk_checklist_item"
  | "populate_risk_checklist"
  | "create_incident_report"
  | "add_continuity_note"
  | "update_funding_details"
  | "assign_scenes_by_location"
  | "assign_scenes_to_shoot_day"
  | "book_location"
  | "request_equipment"
  | "invite_casting_talent"
  | "invite_crew_team"
  | "update_shoot_progress"
  | "create_dailies_batch"
  | "add_dailies_note"
  | "sync_production_workspace_tasks"
  | "add_music_selection"
  | "create_footage_asset"
  | "submit_distribution";

export type ModocActionPayload = {
  projectId?: string;
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  date?: string;
  department?: string;
  priority?: string;
  assigneeId?: string;
  template?: string;
  unit?: string;
  callTime?: string;
  wrapTime?: string;
  locationSummary?: string;
  name?: string;
  role?: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
  amount?: number;
  logline?: string;
  notes?: string;
  genres?: string;
  vendor?: string;
  shootDayId?: string;
  breakdownLocationId?: string;
  locationListingId?: string;
  sceneId?: string;
  phase?: string;
  status?: string;
  taskId?: string;
  category?: string;
  severity?: string;
  fundingOption?: string;
  mode?: string;
  equipmentListingId?: string;
  locationId?: string;
  equipmentId?: string;
  trackId?: string;
  fileUrl?: string;
  batchId?: string;
  needId?: string;
  roleId?: string;
  talentId?: string;
  castingAgencyId?: string;
  crewTeamId?: string;
  crewMemberId?: string;
  target?: string;
  completionPercent?: number;
  message?: string;
  startDate?: string;
  endDate?: string;
};

/** All actions the VA can execute — used for validation and prompts. */
export const MODOC_ACTION_TYPES: ModocActionType[] = [
  "breakdown_full",
  "breakdown_scenes",
  "sync_scenes_from_script",
  "auto_populate_breakdown",
  "create_calendar_event",
  "create_team_calendar_event",
  "create_project_task",
  "create_starter_tasks",
  "complete_project_task",
  "move_to_production",
  "update_project_phase",
  "create_budget",
  "generate_budget_from_breakdown",
  "generate_smart_budget",
  "add_budget_line",
  "create_shoot_day",
  "auto_schedule_shoot_days",
  "sync_casting_from_breakdown",
  "create_casting_role",
  "create_crew_need",
  "sync_starter_crew_needs",
  "add_breakdown_location",
  "link_location_to_marketplace",
  "add_equipment_plan_item",
  "create_production_expense",
  "update_idea_notes",
  "create_project_idea",
  "create_table_read_session",
  "generate_call_sheet",
  "add_risk_checklist_item",
  "populate_risk_checklist",
  "create_incident_report",
  "add_continuity_note",
  "update_funding_details",
  "assign_scenes_by_location",
  "assign_scenes_to_shoot_day",
  "book_location",
  "request_equipment",
  "invite_casting_talent",
  "invite_crew_team",
  "update_shoot_progress",
  "create_dailies_batch",
  "add_dailies_note",
  "sync_production_workspace_tasks",
  "add_music_selection",
  "create_footage_asset",
  "submit_distribution",
];

const ACTION_ALIASES: Record<string, ModocActionType> = {
  // Breakdown
  auto_breakdown: "auto_populate_breakdown",
  populate_breakdown: "auto_populate_breakdown",
  run_breakdown: "breakdown_full",
  full_breakdown: "breakdown_full",
  scene_breakdown: "breakdown_scenes",
  sync_scenes: "sync_scenes_from_script",
  import_scenes: "sync_scenes_from_script",

  // Budget
  init_budget: "create_budget",
  setup_budget: "create_budget",
  new_budget: "create_budget",
  create_budget_lines: "generate_smart_budget",
  generate_budget: "generate_smart_budget",
  smart_budget: "generate_smart_budget",
  build_budget: "generate_smart_budget",
  budget_from_script: "generate_smart_budget",
  populate_budget: "generate_smart_budget",
  add_budget_lines: "generate_smart_budget",
  marketplace_budget: "generate_smart_budget",
  budget_from_breakdown: "generate_budget_from_breakdown",
  add_line: "add_budget_line",
  add_budget_item: "add_budget_line",

  // Schedule
  schedule_shoot_day: "create_shoot_day",
  add_shoot_day: "create_shoot_day",
  plan_shoot_days: "auto_schedule_shoot_days",
  auto_schedule: "auto_schedule_shoot_days",
  create_schedule: "auto_schedule_shoot_days",

  // Cast & crew
  sync_casting: "sync_casting_from_breakdown",
  casting_from_breakdown: "sync_casting_from_breakdown",
  add_casting_role: "create_casting_role",
  add_crew: "create_crew_need",
  add_crew_role: "create_crew_need",
  starter_crew: "sync_starter_crew_needs",
  sync_crew: "sync_starter_crew_needs",

  // Locations & equipment
  add_location: "add_breakdown_location",
  link_location: "link_location_to_marketplace",
  link_marketplace_location: "link_location_to_marketplace",
  add_equipment: "add_equipment_plan_item",
  plan_equipment: "add_equipment_plan_item",

  // Tasks & calendar
  create_task: "create_project_task",
  add_task: "create_project_task",
  complete_task: "complete_project_task",
  mark_task_done: "complete_project_task",
  starter_tasks: "create_starter_tasks",
  on_set_tasks: "create_starter_tasks",

  // Production
  move_production: "move_to_production",
  start_production: "move_to_production",
  set_phase: "update_project_phase",
  update_phase: "update_project_phase",
  create_expense: "create_production_expense",
  log_expense: "create_production_expense",
  table_read: "create_table_read_session",
  schedule_table_read: "create_table_read_session",
  call_sheet: "generate_call_sheet",
  generate_callsheet: "generate_call_sheet",
  log_incident: "create_incident_report",
  report_incident: "create_incident_report",
  continuity_note: "add_continuity_note",
  add_continuity: "add_continuity_note",

  // Risk & funding
  add_risk_item: "add_risk_checklist_item",
  risk_checklist: "populate_risk_checklist",
  starter_risk_checklist: "populate_risk_checklist",
  update_funding: "update_funding_details",
  funding_request: "update_funding_details",

  // Ideas
  update_idea: "update_idea_notes",
  save_logline: "update_idea_notes",
  new_idea: "create_project_idea",
  add_idea: "create_project_idea",

  // Scheduling depth
  schedule_by_location: "assign_scenes_by_location",
  group_scenes_by_location: "assign_scenes_by_location",
  assign_scenes: "assign_scenes_to_shoot_day",

  // Marketplace
  book_location: "book_location",
  location_booking: "book_location",
  request_equipment: "request_equipment",
  equipment_request: "request_equipment",
  invite_cast: "invite_casting_talent",
  casting_invite: "invite_casting_talent",
  invite_crew: "invite_crew_team",
  crew_invite: "invite_crew_team",

  // Production ops
  shoot_progress: "update_shoot_progress",
  mark_scene_done: "update_shoot_progress",
  dailies_batch: "create_dailies_batch",
  dailies_note: "add_dailies_note",
  sync_workspace_tasks: "sync_production_workspace_tasks",
  sync_tasks: "sync_production_workspace_tasks",

  // Post-production
  add_music: "add_music_selection",
  music_selection: "add_music_selection",
  ingest_footage: "create_footage_asset",
  footage_asset: "create_footage_asset",
  distribution_submit: "submit_distribution",
  submit_for_distribution: "submit_distribution",
};

export function normalizeModocActionType(raw: string): ModocActionType | null {
  const key = raw.trim();
  if ((MODOC_ACTION_TYPES as string[]).includes(key)) {
    return key as ModocActionType;
  }
  return ACTION_ALIASES[key] ?? null;
}

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
    const action = normalizeModocActionType(parsed.type);
    if (!action) return null;
    const { type: _t, ...payload } = parsed;
    return { action, payload };
  } catch {
    return null;
  }
}
