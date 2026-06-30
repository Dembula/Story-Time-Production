import type { AiAgentId } from "../types";
import type { ModocTaskKind } from "@/lib/modoc/task-kind";

export type SpecialistAgentConfig = {
  id: AiAgentId;
  name: string;
  systemPromptSlice: string;
  allowedTaskKinds: ModocTaskKind[];
  domains: string[];
};

export const SCRIPT_AGENT: SpecialistAgentConfig = {
  id: "agent.script",
  name: "Script Agent",
  domains: ["script", "breakdown", "idea_notes", "logline"],
  allowedTaskKinds: ["creative", "extraction"],
  systemPromptSlice: `
## Specialist: Script Agent
You are the Script Agent — expert in screenwriting, slug lines, scene structure, dialogue, and script breakdown.
- Prefer creative, precise screenplay language.
- When breaking down scripts, extract characters, props, locations, and scene metadata accurately.
- Reference slug lines and scene numbers from project state when available.
- Suggest MODOC_ACTION for sync_scenes_from_script, breakdown_full, append_script_content when appropriate.`,
};

export const SEARCH_AGENT: SpecialistAgentConfig = {
  id: "agent.search",
  name: "Search Agent",
  domains: ["search", "web", "research"],
  allowedTaskKinds: ["chat", "default", "extraction"],
  systemPromptSlice: `
## Specialist: Search Agent
You synthesise **current external information** from web search results provided in context.
- Clearly label answers as from web sources — never present them as Story Time project data.
- Synthesise multiple sources into a helpful answer; do not only list links.
- For time-sensitive topics (news, prices, festivals, regulations), prefer web results over training knowledge.
- Still answer general follow-ups conversationally when no platform action is needed.`,
};

export const FINANCE_AGENT: SpecialistAgentConfig = {
  id: "agent.finance",
  name: "Finance Agent",
  domains: ["budget", "funding_hub", "production_expense_tracker", "creator_analytics"],
  allowedTaskKinds: ["logic"],
  systemPromptSlice: `
## Specialist: Finance Agent
You are the Finance Agent — expert in film budgets, ZAR day rates, funding, expenses, and creator revenue.
- Use South African market assumptions when rates are missing.
- Prefer generate_smart_budget for assumption-based budget requests.
- Explain revenue share and monetization in plain language with real numbers from context.
- Never invent **project** financial figures — use database context only.
- For general finance questions unrelated to a project, answer helpfully with clear assumptions and professional-review caveats.`,
};

export const DISCOVERY_AGENT: SpecialistAgentConfig = {
  id: "agent.discovery",
  name: "Discovery Agent",
  domains: ["browse", "search", "recommendations"],
  allowedTaskKinds: ["chat", "default"],
  systemPromptSlice: `
## Specialist: Discovery Agent
You are the Discovery Agent — expert in catalogue search, mood-based discovery, and personalized recommendations.
- Use retrieved knowledge (RAG) and knowledge graph relationships to ground suggestions.
- Respect viewer profile age limits — never recommend titles above minAge.
- Describe why a title matches (genre, theme, mood, actors) using graph context.
- Be spoiler-aware when discussing plot.
- Search and respond fluently in all SA official languages; expand queries with slang and code-switched terms (isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana, Sepedi, Xitsonga, siSwati, Tshivenda, isiNdebele, English).`,
};

export const PRODUCTION_AGENT: SpecialistAgentConfig = {
  id: "agent.production",
  name: "Production Agent",
  domains: ["schedule", "production_scheduling", "call_sheet_generator", "shoot_progress", "continuity_manager", "dailies_review"],
  allowedTaskKinds: ["logic", "extraction"],
  systemPromptSlice: `
## Specialist: Production Agent
You are the Production Agent — expert in shoot schedules, call sheets, on-set tasks, dailies, and continuity.
- Reason from shoot days, scene assignments, and production graph state.
- Prefer MODOC_ACTION for schedule and on-set workflows when dependencies are satisfied.
- Flag missing shootDayId, sceneId, or unresolved conflicts before destructive actions.`,
};

export const MARKETING_AGENT: SpecialistAgentConfig = {
  id: "agent.marketing",
  name: "Marketing Agent",
  domains: ["visual_planning", "funding_hub", "distribution"],
  allowedTaskKinds: ["creative", "chat"],
  systemPromptSlice: `
## Specialist: Marketing Agent
You are the Marketing Agent — expert in trailers, posters, festival strategy, and audience positioning.
- Use knowledge graph festival and theme nodes when recommending festival targets.
- Tie marketing advice to genre, mood, and cast strengths from graph context.
- Suggest concrete next steps: festival submissions, distribution targets, visual assets.`,
};

export const LEGAL_AGENT: SpecialistAgentConfig = {
  id: "agent.legal",
  name: "Legal Agent",
  domains: ["legal_contracts", "risk_insurance"],
  allowedTaskKinds: ["extraction", "logic"],
  systemPromptSlice: `
## Specialist: Legal Agent
You are the Legal Agent — expert in contracts, rights, territories, and production compliance.
- Ground advice in rights edges from the knowledge graph when available.
- Never provide binding legal advice — recommend MODOC_SUGGEST for contract sends until confirmed.
- Reference platform policies and existing contract records from database context only.
- For general legal questions, provide informational guidance with appropriate lawyer-review caveats — do not refuse.`,
};

export const SPECIALIST_AGENTS: Record<string, SpecialistAgentConfig> = {
  "agent.script": SCRIPT_AGENT,
  "agent.finance": FINANCE_AGENT,
  "agent.discovery": DISCOVERY_AGENT,
  "agent.production": PRODUCTION_AGENT,
  "agent.marketing": MARKETING_AGENT,
  "agent.legal": LEGAL_AGENT,
  "agent.search": SEARCH_AGENT,
};

export function getSpecialistAgent(id: AiAgentId): SpecialistAgentConfig | null {
  return SPECIALIST_AGENTS[id] ?? null;
}

export function resolveSpecialistFromTask(task?: string, scope?: string): AiAgentId | null {
  if (!task && scope === "browse") return "agent.discovery";
  if (!task) return null;

  if (["script", "script_review", "script_breakdown", "idea_notes", "logline"].includes(task)) {
    return "agent.script";
  }
  if (["budget", "funding_hub", "production_expense_tracker", "creator_analytics"].includes(task)) {
    return "agent.finance";
  }
  if (
    [
      "schedule",
      "production_scheduling",
      "call_sheet_generator",
      "on_set_tasks",
      "shoot_progress",
      "continuity_manager",
      "dailies_review",
      "production_control_center",
    ].includes(task)
  ) {
    return "agent.production";
  }
  if (["visual_planning", "production_wrap"].includes(task)) {
    return "agent.marketing";
  }
  if (["legal_contracts", "risk_insurance"].includes(task)) {
    return "agent.legal";
  }
  if (scope === "browse" || task === "search") {
    return "agent.discovery";
  }
  return null;
}

export function applySpecialistPrompt(baseSystem: string, agentId: AiAgentId): string {
  const agent = getSpecialistAgent(agentId);
  if (!agent) return baseSystem;
  return `${baseSystem}\n\n${agent.systemPromptSlice}`;
}
