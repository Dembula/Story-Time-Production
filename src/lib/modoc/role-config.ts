export type ModocRoleProfile = {
  label: string;
  subtitle: string;
  emptyHint: string;
  scope: string;
  quickPrompts: string[];
};

const CREATOR_PROMPTS = [
  "What should I do next on this project?",
  "Break down my latest script",
  "Help me plan shoot days",
  "Review my budget for gaps",
];

const VIEWER_PROMPTS = [
  "Find a film with an emotional chase scene",
  "Suggest something based on what I watched",
  "What's on my watchlist worth starting tonight?",
  "Describe a scene — help me find which title it's from",
];

const COMPANY_PROMPTS = [
  "Summarize my open requests",
  "How do I respond to a booking?",
  "Tips for my company profile",
];

const FUNDER_PROMPTS = [
  "Explain the funding workflow",
  "What deals are available?",
];

const MUSIC_PROMPTS = [
  "How do sync requests work?",
  "Tips for licensing my tracks",
];

export function getModocRoleProfile(role: string | null | undefined): ModocRoleProfile {
  switch (role) {
    case "SUBSCRIBER":
      return {
        label: "MODOC",
        subtitle: "Find titles · Scene search · Personalized picks",
        emptyHint: "Describe a scene, mood, or ask for recommendations from the Story Time catalog.",
        scope: "browse",
        quickPrompts: VIEWER_PROMPTS,
      };
    case "MUSIC_CREATOR":
      return {
        label: "MODOC",
        subtitle: "Music catalog · Sync deals · Creator tools",
        emptyHint: "Ask about sync licensing, your catalog, or production workflows on Story Time.",
        scope: "music-creator",
        quickPrompts: MUSIC_PROMPTS,
      };
    case "FUNDER":
      return {
        label: "MODOC",
        subtitle: "Deals · Verification · Portfolio insights",
        emptyHint: "Ask about funding opportunities, verification, or creator projects.",
        scope: "funder",
        quickPrompts: FUNDER_PROMPTS,
      };
    case "CASTING_AGENCY":
    case "CREW_TEAM":
    case "CATERING_COMPANY":
    case "EQUIPMENT_COMPANY":
    case "LOCATION_OWNER":
      return {
        label: "MODOC",
        subtitle: "Bookings · Requests · Marketplace",
        emptyHint: "Ask about your dashboard, open requests, bookings, or how Story Time marketplace works.",
        scope: role.toLowerCase().replace(/_/g, "-"),
        quickPrompts: COMPANY_PROMPTS,
      };
    case "ADMIN":
      return {
        label: "MODOC",
        subtitle: "Platform assistant",
        emptyHint: "Admin tools are managed separately. MODOC focuses on creator and viewer workflows.",
        scope: "admin",
        quickPrompts: [],
      };
    case "CONTENT_CREATOR":
    default:
      return {
        label: "Virtual Assistant (VA)",
        subtitle: "Your projects · Production · Calendar",
        emptyHint:
          "Ask anything about your projects, scripts, breakdowns, budgets, schedules, or production workflow. I can run actions — breakdowns, budgets, tasks, shoot days, casting sync, expenses, calendar events, and more.",
        scope: "creator",
        quickPrompts: CREATOR_PROMPTS,
      };
  }
}

export function derivePageContext(pathname: string): Record<string, string> {
  const ctx: Record<string, string> = { pathname };
  const projectMatch = pathname.match(/\/creator\/projects\/([^/]+)/);
  if (projectMatch) ctx.projectId = projectMatch[1];

  const toolMatch = pathname.match(/\/(?:pre-production|production|post-production)\/([^/]+)/);
  if (toolMatch) ctx.tool = toolMatch[1];

  if (pathname.startsWith("/browse")) ctx.area = "browse";
  const contentMatch = pathname.match(/\/browse\/content\/([^/]+)/);
  if (contentMatch) ctx.contentId = contentMatch[1];
  else if (pathname.includes("/command-center")) ctx.area = "command-center";
  else if (pathname.includes("/pre-production")) ctx.area = "pre-production";
  else if (pathname.includes("/production")) ctx.area = "production";
  else if (pathname.includes("/post-production")) ctx.area = "post-production";

  const task = toolSlugToModocTask(ctx.tool);
  if (task) ctx.task = task;

  return ctx;
}

/** Maps creator tool URL slugs to MODOC chat task ids (underscore form). */
export function toolSlugToModocTask(tool: string | undefined): string | undefined {
  if (!tool) return undefined;
  const map: Record<string, string> = {
    "script-review": "script_review",
    "script-breakdown": "script_breakdown",
    "budget-builder": "budget",
    "production-scheduling": "schedule",
    "casting-portal": "casting_portal",
    "crew-marketplace": "crew_marketplace",
    "location-marketplace": "location_marketplace",
    "visual-planning": "visual_planning",
    "legal-contracts": "legal_contracts",
    "funding-hub": "funding_hub",
    "table-reads": "table_reads",
    "production-workspace": "production_workspace",
    "equipment-planning": "equipment_planning",
    "risk-insurance": "risk_insurance",
    "production-readiness": "production_readiness",
    "control-center": "production_control_center",
    "call-sheet-generator": "call_sheet_generator",
    "on-set-tasks": "on_set_tasks",
    "equipment-tracking": "equipment_tracking",
    "shoot-progress": "shoot_progress",
    "continuity-manager": "continuity_manager",
    "dailies-review": "dailies_review",
    "expense-tracker": "production_expense_tracker",
    "incident-reporting": "incident_reporting",
    wrap: "production_wrap",
    "editing-studio": "editing_studio",
  };
  return map[tool];
}
