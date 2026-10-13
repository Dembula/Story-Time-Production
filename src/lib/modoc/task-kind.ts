export type ModocTaskKind =
  | "creative"
  | "extraction"
  | "logic"
  | "chat"
  | "power"
  | "default";

const EXTRACTION_TASKS = new Set([
  "script_breakdown",
  "breakdown",
  "script_review",
  "legal_contracts",
  "production_readiness",
  "creator_analytics",
]);

const CREATIVE_TASKS = new Set([
  "script",
  "idea_notes",
  "logline",
  "visual_planning",
  "funding_hub",
  "table_reads",
]);

const LOGIC_TASKS = new Set([
  "budget",
  "schedule",
  "production_scheduling",
  "risk_insurance",
  "production_expense_tracker",
  "call_sheet_generator",
]);

/** Heavy tools that should use the power model chain (Astra Pro / Opus). */
const POWER_TASKS = new Set([
  "power_tool",
  "deep_analysis",
  "production_strategy",
  "campaign_planner",
  "storyboard",
]);

/** Strip platform name so "story time platform" does not route to creative. */
function textForTaskKindInference(raw: string): string {
  return raw.replace(/\bstory\s*time\b/gi, "storytime_platform");
}

export function resolveModocTaskKind(params: {
  task?: string;
  tool?: string;
  lastUserText?: string;
}): ModocTaskKind {
  const task = params.task ?? "";
  const tool = params.tool ?? "";

  if (
    POWER_TASKS.has(task) ||
    tool.includes("storyboard") ||
    tool.includes("power") ||
    tool.includes("deep-analysis")
  ) {
    return "power";
  }
  if (EXTRACTION_TASKS.has(task) || tool.includes("breakdown") || tool.includes("legal")) {
    return "extraction";
  }
  if (CREATIVE_TASKS.has(task) || tool.includes("script") || tool.includes("idea")) {
    return "creative";
  }
  if (LOGIC_TASKS.has(task) || tool.includes("budget") || tool.includes("schedule")) {
    return "logic";
  }

  const t = textForTaskKindInference((params.lastUserText ?? "").toLowerCase());
  if (/\b(deep analysis|long[- ]horizon|strategy plan|power mode)\b/.test(t)) return "power";
  if (/\b(breakdown|extract|parse|analyze contract)\b/.test(t)) return "extraction";
  if (/\b(budget|schedule|calculate|assign scenes)\b/.test(t)) return "logic";
  if (/\b(write|dialogue|logline|rewrite|screenplay|script draft)\b/.test(t)) return "creative";
  // "story" alone — not "story time" / storytime_platform
  if (/\bstory\b/.test(t) && !/\bstorytime_platform\b/.test(t)) return "creative";

  return "chat";
}
