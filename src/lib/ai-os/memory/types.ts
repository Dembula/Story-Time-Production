import type { ProductionGraph } from "@/lib/modoc/production-graph";

/** Canonical memory scopes for the Story Time AI operating system. */
export type MemoryScope = "conversation" | "user" | "project" | "studio" | "global";

export type ConversationTurn = {
  role: "user" | "assistant" | "system";
  content: string;
  at?: string;
};

export type ConversationMemory = {
  conversationId?: string;
  sessionTool?: string;
  sessionTask?: string;
  recentTurns: ConversationTurn[];
  recentUserIntents: string[];
  at: string;
};

export type UserMemory = {
  acceptedActions: Record<string, number>;
  declinedActions: Record<string, number>;
  preferredSuggestions: string[];
  actionSuccessRates: Record<string, number>;
  recentActions: string[];
  topTopics: Array<{ topic: string; count: number }>;
  playbookRules: Array<{ when: string; then: string; confidence: number }>;
  interactionCount?: number;
  lastSessionIntel?: {
    next_best_action_priority: string | null;
    next_best_action_score: number;
    missing_context_flags: string[];
    action_success_rate_estimate: number;
    suggestion_acceptance_rate: number;
  };
};

export type ProjectMemory = {
  projectId?: string;
  graph: ProductionGraph | null;
};

export type StudioProjectSummary = {
  id: string;
  title: string;
  status: string;
  phase: string;
  sceneCount: number;
  characterCount: number;
  openTasks: number;
  shootDays: number;
  updatedAt: string;
};

export type StudioMemory = {
  projectCount: number;
  projects: StudioProjectSummary[];
};

export type GlobalMemory = {
  workflowPatterns: Array<{ tool: string; nextTool?: string; escalateAction?: string }>;
  platformPolicies: string[];
};

export type StoryTimeMemoryLayers = {
  conversation: ConversationMemory;
  user: UserMemory;
  project: ProjectMemory;
  studio: StudioMemory;
  global: GlobalMemory;
};

export type AssembledStoryTimeMemory = {
  layers: StoryTimeMemoryLayers;
  promptBlock: string;
  missingContextFlags: string[];
  loadedScopes: MemoryScope[];
};

export type AssembleStoryTimeMemoryParams = {
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
  graph?: ProductionGraph | null;
  pageContext?: Record<string, unknown>;
  recentUserMessages?: string[];
  /** When false, skip studio portfolio query (viewer-only chats). */
  includeStudio?: boolean;
};
