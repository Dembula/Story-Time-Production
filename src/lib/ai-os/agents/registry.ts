import type { AiAgentId } from "../types";

export type AiAgentDefinition = {
  id: AiAgentId;
  name: string;
  description: string;
  /** Milestone 1: only modoc.* agents are active. Others are registered for future routing. */
  active: boolean;
  domains: string[];
  preferredTaskKinds: Array<"creative" | "extraction" | "logic" | "chat" | "default">;
};

/** Central registry of specialist agents. MODOC orchestrator selects from this list. */
export const AI_AGENT_REGISTRY: Record<AiAgentId, AiAgentDefinition> = {
  "modoc.legacy": {
    id: "modoc.legacy",
    name: "MODOC Legacy Composite",
    description: "Version 1 monolithic MODOC pipeline — creator + viewer VA until agents are split.",
    active: true,
    domains: ["creator", "viewer", "platform"],
    preferredTaskKinds: ["chat", "creative", "extraction", "logic", "default"],
  },
  "modoc.creator": {
    id: "modoc.creator",
    name: "MODOC Creator",
    description: "Production intelligence for filmmakers — projects, scripts, budgets, schedules.",
    active: true,
    domains: ["creator", "production"],
    preferredTaskKinds: ["creative", "logic", "extraction"],
  },
  "modoc.viewer": {
    id: "modoc.viewer",
    name: "MODOC Viewer",
    description: "Catalogue discovery, recommendations, and playback-aware Q&A.",
    active: true,
    domains: ["viewer", "browse"],
    preferredTaskKinds: ["chat", "default"],
  },
  "agent.script": {
    id: "agent.script",
    name: "Script Agent",
    description: "Script writing, breakdown, scene analysis, and dialogue assistance.",
    active: true,
    domains: ["script", "breakdown"],
    preferredTaskKinds: ["creative", "extraction"],
  },
  "agent.production": {
    id: "agent.production",
    name: "Production Agent",
    description: "Scheduling, call sheets, on-set tasks, dailies, continuity.",
    active: true,
    domains: ["production", "schedule"],
    preferredTaskKinds: ["logic", "extraction"],
  },
  "agent.finance": {
    id: "agent.finance",
    name: "Finance Agent",
    description: "Budgeting, expenses, funding, and monetization planning.",
    active: true,
    domains: ["budget", "finance"],
    preferredTaskKinds: ["logic"],
  },
  "agent.marketing": {
    id: "agent.marketing",
    name: "Marketing Agent",
    description: "Trailers, thumbnails, festival strategy, and audience outreach.",
    active: true,
    domains: ["marketing", "distribution"],
    preferredTaskKinds: ["creative", "chat"],
  },
  "agent.analytics": {
    id: "agent.analytics",
    name: "Analytics Agent",
    description: "Creator performance, watch metrics, and revenue insights.",
    active: false,
    domains: ["analytics"],
    preferredTaskKinds: ["extraction", "logic"],
  },
  "agent.discovery": {
    id: "agent.discovery",
    name: "Discovery Agent",
    description: "Natural language catalogue search and mood-based discovery.",
    active: true,
    domains: ["viewer", "search"],
    preferredTaskKinds: ["chat", "default"],
  },
  "agent.recommendation": {
    id: "agent.recommendation",
    name: "Recommendation Agent",
    description: "Personalized watchlists and hybrid semantic + behavioral recommendations.",
    active: true,
    domains: ["viewer", "recommendations"],
    preferredTaskKinds: ["default"],
  },
  "agent.rights": {
    id: "agent.rights",
    name: "Rights Agent",
    description: "Distribution rights, licensing, and territory management.",
    active: false,
    domains: ["rights", "distribution"],
    preferredTaskKinds: ["logic", "extraction"],
  },
  "agent.legal": {
    id: "agent.legal",
    name: "Legal Agent",
    description: "Contracts, compliance, and policy-grounded guidance.",
    active: true,
    domains: ["legal", "contracts"],
    preferredTaskKinds: ["extraction", "logic"],
  },
  "agent.search": {
    id: "agent.search",
    name: "Search Agent",
    description: "Semantic search, metadata retrieval, and knowledge lookup.",
    active: false,
    domains: ["search", "rag"],
    preferredTaskKinds: ["extraction", "default"],
  },
  "agent.moderation": {
    id: "agent.moderation",
    name: "Moderation Agent",
    description: "Content safety, age ratings, and community moderation.",
    active: false,
    domains: ["moderation", "safety"],
    preferredTaskKinds: ["extraction", "logic"],
  },
  "agent.creator-success": {
    id: "agent.creator-success",
    name: "Creator Success Agent",
    description: "Onboarding, workflow nudges, and proactive next-step guidance.",
    active: false,
    domains: ["creator", "onboarding"],
    preferredTaskKinds: ["chat"],
  },
  "agent.playback-companion": {
    id: "agent.playback-companion",
    name: "Playback Companion Agent",
    description: "X-Ray style scene context — async, never blocks streaming.",
    active: true,
    domains: ["playback", "x-ray"],
    preferredTaskKinds: ["extraction", "chat"],
  },
};

export function getAgent(id: AiAgentId): AiAgentDefinition {
  return AI_AGENT_REGISTRY[id];
}

export function listActiveAgents(): AiAgentDefinition[] {
  return Object.values(AI_AGENT_REGISTRY).filter((a) => a.active);
}
