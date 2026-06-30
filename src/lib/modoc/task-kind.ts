export type ModocTaskKind =
  | "creative"
  | "extraction"
  | "logic"
  | "chat"
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
  if (/\b(breakdown|extract|parse|analyze contract)\b/.test(t)) return "extraction";
  if (/\b(budget|schedule|calculate|assign scenes)\b/.test(t)) return "logic";
  if (/\b(write|dialogue|logline|rewrite|screenplay|script draft)\b/.test(t)) return "creative";
  // "story" alone — not "story time" / storytime_platform
  if (/\bstory\b/.test(t) && !/\bstorytime_platform\b/.test(t)) return "creative";

  return "chat";
}
