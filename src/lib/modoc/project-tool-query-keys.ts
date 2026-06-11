/** React Query key prefixes invalidated when VA mutates data on a creator tool page. */

const PRE_PRODUCTION_TOOL_QUERY_KEYS: Record<string, string[]> = {
  "idea-development": ["project-ideas", "creator-ideas"],
  "script-writing": ["project-script", "creator-scripts", "project-scenes"],
  "script-review": ["script-review", "script-review-v2", "project-script-review-script-v2"],
  "script-breakdown": [
    "project-breakdown",
    "project-scenes",
    "project-script-breakdown",
    "creator-scripts-breakdown",
    "script-review-note-breakdown",
  ],
  "budget-builder": ["project-budget", "project-breakdown", "project-scenes"],
  "production-scheduling": ["project-schedule", "project-breakdown", "project-scenes", "command-center-calendar"],
  "casting-portal": ["project-casting", "project-breakdown"],
  "crew-marketplace": ["project-crew"],
  "location-marketplace": ["project-breakdown", "project-locations"],
  "visual-planning": ["project-visual-assets", "project-breakdown", "project-script"],
  "legal-contracts": ["project-contracts"],
  "funding-hub": ["project-funding"],
  "table-reads": ["project-table-reads", "project-script", "command-center-calendar"],
  "production-workspace": ["project-tasks", "command-center-calendar"],
  "equipment-planning": ["project-equipment", "project-equipment-plan"],
  "risk-insurance": ["project-risk"],
  "production-readiness": ["project-readiness", "production-readiness"],
};

const PRODUCTION_TOOL_QUERY_KEYS: Record<string, string[]> = {
  "control-center": ["production-control-center", "project-tasks", "project-schedule", "command-center-calendar"],
  "call-sheet-generator": ["project-call-sheets", "project-schedule", "project-scenes"],
  "on-set-tasks": ["project-tasks", "command-center-calendar"],
  "equipment-tracking": ["project-equipment-plan", "production-control-center"],
  "shoot-progress": ["project-shoot-progress", "production-control-center", "project-schedule"],
  "continuity-manager": ["project-continuity"],
  "dailies-review": ["project-dailies"],
  "expense-tracker": ["project-expenses", "project-budget"],
  "incident-reporting": ["project-incidents", "command-center-calendar"],
  "on-set-catering": ["project-catering"],
  wrap: ["project-production-wrap", "production-control-center"],
};

const POST_PRODUCTION_TOOL_QUERY_KEYS: Record<string, string[]> = {
  "footage-ingestion": ["project-footage"],
  "editing-studio": ["project-reviews", "project-footage"],
  "sound-design": ["project-tasks", "project-footage"],
  "music-scoring": ["project-music", "project-tasks"],
  "visual-effects": ["project-tasks", "project-footage"],
  "color-grading": ["project-tasks", "project-footage"],
  "final-sound-mix": ["project-tasks"],
  "final-cut-approval": ["project-reviews", "project-footage"],
  "film-packaging": ["project-distribution"],
  distribution: ["project-distribution"],
};

const ALL_TOOL_QUERY_KEYS: Record<string, string[]> = {
  ...PRE_PRODUCTION_TOOL_QUERY_KEYS,
  ...PRODUCTION_TOOL_QUERY_KEYS,
  ...POST_PRODUCTION_TOOL_QUERY_KEYS,
};

export function queryKeysForProjectTool(tool: string): string[] {
  if (!tool) return ["creator-command-center"];
  return ALL_TOOL_QUERY_KEYS[tool] ?? ["creator-command-center"];
}
