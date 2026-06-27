/**
 * Story Time AI Operating System (Version 2 foundation).
 * Evolves MODOC from a monolithic chat route into a modular orchestrator + specialist agents.
 */

export type {
  AiAgentId,
  OrchestrationPhase,
  OrchestrationPlan,
  ModocChatOrchestratorInput,
  ModocChatOrchestratorResult,
} from "./types";

export {
  AI_AGENT_REGISTRY,
  getAgent,
  listActiveAgents,
  type AiAgentDefinition,
} from "./agents/registry";

export { planModocOrchestration, type IntentRouterInput } from "./planner/intent-router";

export {
  runModocChatOrchestrator,
  resolveModocActionsAndPlan,
  ModocOrchestratorError,
} from "./orchestrator/run-modoc-chat";

export type {
  MemoryScope,
  StoryTimeMemoryLayers,
  AssembledStoryTimeMemory,
  AssembleStoryTimeMemoryParams,
} from "./memory";

export { assembleStoryTimeMemory, formatStoryTimeMemoryPrompt } from "./memory";
export {
  assembleStoryTimeMemoryCached,
  invalidateMemoryCache,
} from "./memory/cached-assemble";

export {
  resolveAbExperimentVariant,
  abModelOverride,
  getAbEvaluationSummary,
} from "./evaluation/ab-model";

export type {
  KnowledgeSourceType,
  RetrievedKnowledgeChunk,
  RetrieveKnowledgeResult,
} from "./rag";

export {
  retrieveKnowledge,
  buildRagPromptBlock,
  formatRagPromptBlock,
  indexCatalogueFromEnrichment,
} from "./rag";

export {
  syncContentKnowledgeGraph,
  buildContentGraphContext,
  getRelatedContentIds,
} from "./knowledge-graph";

export { applySpecialistPrompt, resolveSpecialistFromTask } from "./agents/specialists";
export { logAiRequest, getAiObservabilitySummary } from "./observability/log-request";
export { fetchAiAdminDashboardBundle } from "./observability/admin-bundle";

export {
  buildSaLanguagePromptBlock,
  detectSaLanguages,
  indexSaGlossarySeed,
  MODOC_SA_MULTILINGUAL_POLICY,
} from "./languages";
