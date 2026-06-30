import type { ModocTaskKind } from "@/lib/modoc/task-kind";
import type { ModocUserContext } from "@/lib/modoc/types";
import type { UIMessage } from "ai";

/** Canonical agent identifiers for the Story Time AI operating system. */
export type AiAgentId =
  | "modoc.legacy"
  | "modoc.creator"
  | "modoc.viewer"
  | "agent.script"
  | "agent.production"
  | "agent.finance"
  | "agent.marketing"
  | "agent.analytics"
  | "agent.discovery"
  | "agent.recommendation"
  | "agent.rights"
  | "agent.legal"
  | "agent.search"
  | "agent.moderation"
  | "agent.creator-success"
  | "agent.playback-companion";

export type OrchestrationPhase =
  | "validate"
  | "plan"
  | "retrieve"
  | "assemble-context"
  | "execute-tools"
  | "generate"
  | "learn";

export type OrchestrationPlan = {
  /** Primary agent handling this request (Milestone 1: always legacy composite). */
  primaryAgentId: AiAgentId;
  /** Future multi-agent workflows will populate this. */
  supportingAgentIds: AiAgentId[];
  taskKind: ModocTaskKind;
  /** Human-readable routing reason for observability. */
  routingReason: string;
  /** Classified user intent for response mode and tooling. */
  intentCategory?: string;
  responseMode?: "conversational" | "production_protocol";
  needsWebSearch?: boolean;
  webSearchQuery?: string;
  webSearchUsed?: boolean;
};

export type ModocChatOrchestratorInput = {
  userId: string;
  sessionRole: string;
  scope?: string;
  path: string;
  pageContext?: Record<string, string | number | boolean | null>;
  conversationId?: string;
  rawMessages: UIMessage[];
  userContext: ModocUserContext | null;
  systemPrompt: string;
  executeAction?: { type: string; payload?: Record<string, unknown> };
  focusProjectId?: string | null;
  memoryCacheHit?: boolean;
};

export type ModocChatOrchestratorResult = {
  plan: OrchestrationPlan;
  streamResponse: Response;
};
