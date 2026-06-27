import "server-only";

import type { ProductionGraph } from "./production-graph";
import type { ModocLearningProfile } from "./learning";
import type { ModocActionType } from "./action-types";
import { assembleStoryTimeMemoryCached } from "@/lib/ai-os/memory/cached-assemble";
import type { StoryTimeMemoryLayers } from "@/lib/ai-os/memory/types";

/** @deprecated Use StoryTimeMemoryLayers from @/lib/ai-os/memory — kept for backward compatibility. */
export type ModocMemoryLayers = {
  shortTerm: {
    sessionTool?: string;
    sessionTask?: string;
    recentUserIntents: string[];
    recentActions: string[];
    at: string;
  };
  project: ProductionGraph | null;
  behavioral: {
    acceptedActions: Record<string, number>;
    declinedActions: Record<string, number>;
    preferredSuggestions: string[];
    actionSuccessRates: Record<string, number>;
    lastSessionIntel?: {
      next_best_action_priority: string | null;
      next_best_action_score: number;
      missing_context_flags: string[];
      action_success_rate_estimate: number;
      suggestion_acceptance_rate: number;
    };
  };
  system: {
    workflowPatterns: Array<{ tool: string; nextTool?: string; escalateAction?: string }>;
    playbookRules: Array<{ when: string; then: string; confidence: number }>;
  };
};

export type AssembledModocMemory = {
  layers: ModocMemoryLayers;
  promptBlock: string;
  missingContextFlags: string[];
  /** Version 2 five-layer memory (primary). */
  storyTimeLayers: StoryTimeMemoryLayers;
  /** True when served from Redis/in-memory hot cache. */
  cacheHit?: boolean;
};

function toLegacyLayers(layers: StoryTimeMemoryLayers): ModocMemoryLayers {
  return {
    shortTerm: {
      sessionTool: layers.conversation.sessionTool,
      sessionTask: layers.conversation.sessionTask,
      recentUserIntents: layers.conversation.recentUserIntents,
      recentActions: layers.user.recentActions,
      at: layers.conversation.at,
    },
    project: layers.project.graph,
    behavioral: {
      acceptedActions: layers.user.acceptedActions,
      declinedActions: layers.user.declinedActions,
      preferredSuggestions: layers.user.preferredSuggestions,
      actionSuccessRates: layers.user.actionSuccessRates,
      ...(layers.user.lastSessionIntel ? { lastSessionIntel: layers.user.lastSessionIntel } : {}),
    },
    system: {
      workflowPatterns: layers.global.workflowPatterns,
      playbookRules: layers.user.playbookRules,
    },
  };
}

/** Assemble structured memory layers for MODOC reasoning (delegates to AI OS memory). */
export async function assembleModocMemory(params: {
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  graph: ProductionGraph | null;
  pageContext?: Record<string, unknown>;
  recentUserMessages?: string[];
  includeStudio?: boolean;
}): Promise<AssembledModocMemory> {
  const assembled = await assembleStoryTimeMemoryCached({
    userId: params.userId,
    projectId: params.projectId,
    conversationId: params.conversationId,
    graph: params.graph,
    pageContext: params.pageContext,
    recentUserMessages: params.recentUserMessages,
    includeStudio: params.includeStudio,
  });

  return {
    layers: toLegacyLayers(assembled.layers),
    promptBlock: assembled.promptBlock,
    missingContextFlags: assembled.missingContextFlags,
    storyTimeLayers: assembled.layers,
    cacheHit: assembled.cacheHit,
  };
}

/** Rank suggested action by behavioral success + acceptance. */
export function scoreActionPriority(
  action: ModocActionType,
  learning: ModocLearningProfile,
  successRates: Record<string, number>,
): number {
  const accepted = learning.acceptedActions?.[action] ?? 0;
  const declined = learning.declinedActions?.[action] ?? 0;
  const rate = successRates[action] ?? 0.7;
  const pref = learning.preferredSuggestions?.includes(action) ? 0.15 : 0;
  const acceptance = accepted + declined > 0 ? accepted / (accepted + declined) : 0.5;
  return rate * 0.5 + acceptance * 0.35 + pref;
}
