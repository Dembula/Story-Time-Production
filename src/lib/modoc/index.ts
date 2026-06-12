/**
 * MODOC — Machine Orchestrating Digital Operations for Creation
 * Platform-wide AI assistant for Story Time.
 */

export {
  buildModocSystemPrompt,
  MODOC_IDENTITY,
  MODOC_OS_PRINCIPLES,
  PLATFORM_SUMMARY,
  MODOC_IDEA_DEVELOPMENT_INSTRUCTIONS,
  MODOC_SCRIPT_WRITING_INSTRUCTIONS,
  MODOC_TASK_LOGLINE,
  MODOC_TASK_IDEA_NOTES,
  MODOC_TASK_SCRIPT,
  MODOC_TASK_SCRIPT_REVIEW,
  MODOC_TASK_SCRIPT_BREAKDOWN,
  MODOC_TASK_BUDGET,
  MODOC_TASK_SCHEDULE,
  MODOC_TASK_LOCATION_MARKETPLACE,
  MODOC_TASK_EQUIPMENT_PLANNING,
  MODOC_TASK_CASTING_PORTAL,
  MODOC_TASK_CREW_MARKETPLACE,
  MODOC_TASK_VISUAL_PLANNING,
  MODOC_TASK_LEGAL_CONTRACTS,
  MODOC_TASK_EDITING_STUDIO,
  MODOC_TASK_FUNDING_HUB,
  MODOC_TASK_TABLE_READS,
  MODOC_TASK_PRODUCTION_WORKSPACE,
  MODOC_TASK_RISK_INSURANCE,
  MODOC_TASK_PRODUCTION_READINESS,
  MODOC_TASK_PRODUCTION_CONTROL_CENTER,
  MODOC_TASK_CALL_SHEET_GENERATOR,
  MODOC_TASK_ON_SET_TASKS,
  MODOC_TASK_EQUIPMENT_TRACKING,
  MODOC_TASK_SHOOT_PROGRESS,
  MODOC_TASK_CONTINUITY_MANAGER,
  MODOC_TASK_DAILIES_REVIEW,
  MODOC_TASK_PRODUCTION_EXPENSE_TRACKER,
  MODOC_TASK_INCIDENT_REPORTING,
  MODOC_TASK_PRODUCTION_WRAP,
  MODOC_TASK_CREATOR_ANALYTICS,
} from "./system-prompt";
export type {
  ModocChatMessage,
  ModocChatRequest,
  ModocPlatformContext,
  ModocUserContext,
} from "./types";
export {
  buildProductionGraph,
  formatProductionGraphForPrompt,
  isDestructiveModocAction,
  type ProductionGraph,
  type ProductionGraphNode,
  type ProductionGraphEdge,
  type ReadinessSignal,
} from "./production-graph";
export { assembleModocMemory, type ModocMemoryLayers } from "./modoc-memory";
export {
  MODOC_RESPONSE_PROTOCOL,
  parseModocSuggestFromText,
  parseModocIntelFromText,
  stripModocMachineBlocks,
  stripModocProtocolLines,
  type ModocSuggestBlock,
  type ModocIntelBlock,
} from "./response-protocol";
export {
  resolveModocTaskKind,
  streamModocWithFallback,
  modelsForTask,
  primaryModocModel,
  normalizeOpenRouterModelId,
  type ModocTaskKind,
} from "./model-router";
export { OPENROUTER_DEFAULT_MODELS } from "./openrouter-models";
export {
  appendSessionIntel,
  getLatestSessionIntel,
  type StoredModocSessionIntel,
} from "./learning-store";
export { validateModocActionSafety } from "./action-safety";
export { buildModocSessionIntel, persistModocSessionIntel } from "./learning-loop";
export { buildSlicedContext } from "./context-slicer";
