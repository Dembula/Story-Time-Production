/**
 * VA auto-learning capacity limits — tuned for high-volume creators and long-running playbooks.
 * Stored data can grow large in Postgres; prompt injection stays bounded for LLM token budgets.
 */

/** Max playbook rules persisted per creator (DB). */
export const MAX_PLAYBOOK_RULES_STORED = 10_000;

/** Max rules injected into a single chat system prompt. */
export const MAX_PLAYBOOK_RULES_IN_PROMPT = 120;

/** Max action log rows per creator before oldest are pruned. */
export const MAX_ACTION_LOG_ROWS = 50_000;

/** Max action log lines in awareness/prompt context. */
export const MAX_ACTION_LOG_IN_PROMPT = 50;

/** Max distinct topic stats per creator. */
export const MAX_TOPIC_STATS = 500;

/** Max topics shown in playbook prompt summary. */
export const MAX_TOPIC_STATS_IN_PROMPT = 40;

/** Legacy JSON fallback cap when DB tables are unavailable. */
export const MAX_PLAYBOOK_JSON_FALLBACK = 2_000;

/** Legacy JSON recent-actions fallback cap. */
export const MAX_RECENT_ACTIONS_JSON = 500;

/** Max preferred suggestion action types tracked. */
export const MAX_PREFERRED_SUGGESTIONS = 100;

/** Database context query limits (per chat request). */
export const MAX_PROJECTS_IN_DB_CONTEXT = 100;
export const MAX_TASKS_IN_DB_CONTEXT = 150;
export const MAX_CALENDAR_IN_DB_CONTEXT = 150;
export const MAX_SHOOT_DAYS_IN_DB_CONTEXT = 100;
export const MAX_VA_MESSAGES_IN_DB_CONTEXT = 30;

/** Calendar lookback for awareness (days). */
export const CALENDAR_LOOKBACK_DAYS = 30;

/** Viewer MODOC database context limits (per chat request). */
export const MAX_VIEWER_CATALOG_IN_CONTEXT = 120;
export const MAX_VIEWER_SCENES_IN_CONTEXT = 48;
export const MAX_VIEWER_DIALOGUE_LINES = 24;
export const MAX_VIEWER_WATCH_HISTORY = 40;
export const MAX_VIEWER_WATCHLIST = 20;
export const MAX_VIEWER_CONTINUE_WATCHING = 8;
export const MAX_VIEWER_SEMANTIC_MATCHES = 16;

/** Batch size for playbook upserts per learning turn. */
export const PLAYBOOK_UPSERT_BATCH = 32;

/** Prune playbook rules below this confidence when over storage cap. */
export const PLAYBOOK_PRUNE_MIN_CONFIDENCE = 0.12;

/** Playbook rule score: confidence × hits × recency boost. */
export function scorePlaybookRule(rule: {
  confidence: number;
  hits: number;
  version: number;
  updatedAt: string | Date;
}): number {
  const updated = rule.updatedAt instanceof Date ? rule.updatedAt : new Date(rule.updatedAt);
  const ageDays = Math.max(0, (Date.now() - updated.getTime()) / (24 * 60 * 60 * 1000));
  const recencyBoost = 1 + Math.max(0, 1 - ageDays / 90);
  return rule.confidence * rule.hits * recencyBoost * (1 + Math.log1p(rule.version));
}
