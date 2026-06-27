import type { ModocPlaybookEntry } from "./learning";
import {
  MAX_PLAYBOOK_RULES_IN_PROMPT,
  MAX_TOPIC_STATS_IN_PROMPT,
} from "./learning-limits";

export const TOPIC_PATTERNS: Array<{ topic: string; pattern: RegExp }> = [
  { topic: "calendar", pattern: /\b(calendar|schedule|planning|week|event|meeting|appointment)\b/i },
  { topic: "script", pattern: /\b(script|screenplay|scene|breakdown|slug|dialogue|draft)\b/i },
  { topic: "budget", pattern: /\b(budget|cost|money|fund|expense|finance)\b/i },
  { topic: "production", pattern: /\b(production|shoot|on-set|call sheet|wrap|filming)\b/i },
  { topic: "tasks", pattern: /\b(task|to-do|todo|checklist|action item)\b/i },
  { topic: "redo", pattern: /\b(redo|again|deleted|mistake|restore|recreate|undo)\b/i },
  { topic: "casting", pattern: /\b(cast|casting|actor|talent|audition)\b/i },
  { topic: "crew", pattern: /\b(crew|gaffer|grip|sound|dop|department)\b/i },
  { topic: "locations", pattern: /\b(location|set|venue|scout|filming location)\b/i },
  { topic: "equipment", pattern: /\b(equipment|camera|gear|rental|lens)\b/i },
  { topic: "funding", pattern: /\b(fund|investor|funder|grant|finance deal)\b/i },
  { topic: "analytics", pattern: /\b(analytic|metric|performance|view|audience)\b/i },
  { topic: "legal", pattern: /\b(contract|legal|release|rights|license)\b/i },
  { topic: "post", pattern: /\b(post-production|edit|color|sound mix|vfx)\b/i },
  { topic: "music", pattern: /\b(music|score|soundtrack|sync)\b/i },
  { topic: "command_center", pattern: /\b(command center|dashboard|overview)\b/i },
  { topic: "deadline", pattern: /\b(deadline|due|urgent|asap|tomorrow|today)\b/i },
  { topic: "help", pattern: /\b(help|how do i|what should|next step|stuck)\b/i },
  { topic: "sa_language", pattern: /\b(isizulu|isixhosa|afrikaans|sesotho|setswana|sepedi|xitsonga|siswati|tshivenda|ndebele|zulu|xhosa|pedi|sotho|translate|slang|yebo|sawubona|molo|dumela|lumela|thobela|lekker|sharp sharp|eish)\b/i },
];

type PlaybookDraft = Pick<ModocPlaybookEntry, "when" | "then" | "origin" | "confidence">;

export function extractMessageTopics(text: string): string[] {
  const topics = new Set<string>();
  for (const { topic, pattern } of TOPIC_PATTERNS) {
    if (pattern.test(text)) topics.add(topic);
  }
  return Array.from(topics);
}

function draft(when: string, then: string, confidence: number): PlaybookDraft {
  return { when, then, origin: "pattern_detected", confidence };
}

export function derivePlaybookDraftsFromTurn(turn: {
  userMessage: string;
  assistantMessage?: string;
  topicCounts: Record<string, number>;
}): PlaybookDraft[] {
  const userMessage = turn.userMessage.trim();
  const drafts: PlaybookDraft[] = [];
  if (!userMessage) return drafts;

  const topics = extractMessageTopics(userMessage);
  const counts = turn.topicCounts;

  if (topics.includes("redo")) {
    drafts.push(
      draft(
        "User mentions redo, deleted, or mistake",
        "Check VA action log and live calendar database; recreate missing items immediately.",
        0.88,
      ),
    );
  }
  if (topics.includes("calendar") || (counts.calendar ?? 0) >= 2) {
    drafts.push(
      draft(
        "User discusses schedule or calendar",
        "Query calendar database; create or restore Command Center events with real IDs.",
        0.75,
      ),
    );
  }
  if (topics.includes("script") || (counts.script ?? 0) >= 2) {
    drafts.push(
      draft(
        "User works on scripts or breakdowns",
        "Check script/scene/character counts; run sync or breakdown when gaps exist.",
        0.76,
      ),
    );
  }
  if (topics.includes("budget") || (counts.budget ?? 0) >= 2) {
    drafts.push(
      draft(
        "User asks about budget",
        "Reference budget line counts; flag zero-line budgets in pre-production.",
        0.72,
      ),
    );
  }
  if (topics.includes("production") || (counts.production ?? 0) >= 2) {
    drafts.push(
      draft(
        "User is in production",
        "Prioritize shoot days and open tasks from database.",
        0.78,
      ),
    );
  }
  if (topics.includes("casting")) {
    drafts.push(
      draft(
        "User mentions casting",
        "Suggest casting prep tasks and auditions workflow.",
        0.65,
      ),
    );
  }
  if (topics.includes("crew")) {
    drafts.push(
      draft(
        "User mentions crew",
        "Suggest crew marketplace and department starter tasks.",
        0.65,
      ),
    );
  }
  if (topics.includes("locations")) {
    drafts.push(
      draft(
        "User mentions locations",
        "Check location and shoot day data from database.",
        0.64,
      ),
    );
  }
  if (topics.includes("funding")) {
    drafts.push(
      draft(
        "User asks about funding",
        "Explain funding hub; use database facts only.",
        0.68,
      ),
    );
  }
  if (topics.includes("deadline")) {
    drafts.push(
      draft(
        "User mentions deadlines",
        "Lead with calendar and tasks; propose dated next actions.",
        0.8,
      ),
    );
  }
  if (topics.includes("help") || userMessage.includes("?")) {
    drafts.push(
      draft(
        "User asks for guidance",
        "Give 2-3 ranked next steps tied to project database data.",
        0.7,
      ),
    );
  }
  if (topics.includes("sa_language")) {
    drafts.push(
      draft(
        "User writes in or asks about SA languages or slang",
        "Reply in their language mix; use glossary context; explain slang respectfully; search catalogue in that language when relevant.",
        0.82,
      ),
    );
  }
  if (userMessage.length > 120) {
    drafts.push(
      draft(
        "User sends detailed requests",
        "Address each part and cite database facts.",
        0.62,
      ),
    );
  }
  if (/please|thank|thanks|appreciate/i.test(userMessage)) {
    drafts.push(
      draft(
        "User is appreciative",
        "Stay warm; offer one proactive next step from project data.",
        0.52,
      ),
    );
  }

  const assistant = turn.assistantMessage?.trim() ?? "";
  if (assistant && /MODOC_ACTION:/i.test(assistant)) {
    drafts.push(
      draft(
        "Assistant proposed MODOC_ACTION",
        "Platform auto-runs actions; summarize outcome and offer follow-up.",
        0.7,
      ),
    );
  }

  return drafts;
}

export function buildAdaptivePlaybookPrompt(params: {
  rules: ModocPlaybookEntry[];
  interactionCount: number;
  lastLearnedAt?: string | null;
  topicCounts: Record<string, number>;
  totalRuleCount?: number;
}): string {
  const { rules, interactionCount, lastLearnedAt, topicCounts, totalRuleCount } = params;
  const stored = totalRuleCount ?? rules.length;

  if (rules.length === 0 && stored === 0) {
    return "**Adaptive playbook:** empty — learning from this creator's conversations.";
  }

  const lines = [
    "**Self-adaptive playbook (auto-learned behavior rules — follow these):**",
    `Stored rules: ${stored.toLocaleString()} | In prompt: ${Math.min(rules.length, MAX_PLAYBOOK_RULES_IN_PROMPT)} | Interactions: ${interactionCount.toLocaleString()} | Last learned: ${lastLearnedAt ?? "never"}`,
    "",
  ];

  for (const rule of rules.slice(0, MAX_PLAYBOOK_RULES_IN_PROMPT)) {
    lines.push(
      `- [v${rule.version} | conf=${rule.confidence.toFixed(2)} | hits=${rule.hits}] WHEN ${rule.when} → THEN ${rule.then}`,
    );
  }

  if (stored > rules.length) {
    lines.push("", `(${stored - rules.length} additional lower-ranked rules stored)`);
  }

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOPIC_STATS_IN_PROMPT);
  if (topTopics.length > 0) {
    lines.push(
      "",
      `**Topic frequency learned:** ${topTopics.map(([t, n]) => `${t}(${n.toLocaleString()})`).join(", ")}`,
    );
  }

  return lines.join("\n");
}
