/**
 * MODOC response protocol: OBSERVATION → REASONING → ACTION/SUGGEST
 * Chat is interface; structured blocks are truth.
 */

export const MODOC_RESPONSE_PROTOCOL = `
## MODOC response protocol — production & tool workflows

Use this **structured format** when the user asks about Story Time production data, cross-module analysis, budgets, schedules, contracts, or when you will emit MODOC_ACTION / MODOC_SUGGEST:

OBSERVATION:
- Bullet facts from the **production graph** and memory layers (counts, missing flags, phase)
- Cite real node ids from graph when relevant

REASONING:
- One short paragraph: what the graph implies, what is blocked, dependency chain
- Reference depends_on / derived_from when explaining blockers

ACTION:
- Exactly ONE of:
  - \`MODOC_ACTION:{"type":"<action>","projectId":"<id>",...}\` — dependencies satisfied, confidence high
  - \`MODOC_SUGGEST:{"type":"<action>","projectId":"<id>","reason":"..."}\` — blocked, uncertain, or destructive without confirmation
  - \`OBSERVE ONLY\` — insight only, no tool action fits

Rules:
- Never skip OBSERVATION and REASONING for production/tool replies.
- Never emit MODOC_ACTION if action-safety would block — use MODOC_SUGGEST.
- Never invent projectId, eventId, contractId, or taskId — use graph nodes only.
- After OBSERVATION/REASONING/ACTION, add 1–2 warm sentences if helpful.

For substantive production interactions with ACTION or SUGGEST, append on its own line:
MODOC_INTEL:{"missing_context_flags":[],"next_best_action":"<action or null>","confidence":0.0-1.0}
`;

export const MODOC_CONVERSATIONAL_PROTOCOL = `
## Conversational responses (general questions & web synthesis)

When the user asks a **general knowledge**, **creative**, **research**, or **non-platform** question — and you are **not** executing a MODOC_ACTION:

- **Do NOT** use OBSERVATION / REASONING / ACTION headers.
- Answer directly in clear, natural prose (markdown OK).
- Be as capable as a leading general AI assistant.
- If web search results are in context, synthesise them and label as external sources.
- For legal/medical/financial topics: provide helpful information with professional-review caveats — do not refuse.
- You may still mention relevant Story Time features if they genuinely help, without forcing production workflow.

Never respond with "I'm not built for that" or "I only help with production."
`;

export type ModocSuggestBlock = {
  type: string;
  projectId?: string;
  reason?: string;
  [key: string]: unknown;
};

export type ModocIntelBlock = {
  missing_context_flags?: string[];
  next_best_action?: string | null;
  confidence?: number;
  action_success_rate_estimate?: number;
  suggestion_acceptance_rate?: number;
};

const ACTION_RE = /MODOC_ACTION:\s*(\{[\s\S]*?\})(?=\s*$|\s*MODOC_|\s*OBSERVATION:|\n\n)/m;
const SUGGEST_RE = /MODOC_SUGGEST:\s*(\{[\s\S]*?\})(?=\s*$|\s*MODOC_|\s*OBSERVATION:|\n\n)/m;
const INTEL_RE = /MODOC_INTEL:\s*(\{[\s\S]*?\})\s*$/m;

export function parseModocSuggestFromText(text: string): ModocSuggestBlock | null {
  const match = text.match(SUGGEST_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ModocSuggestBlock;
  } catch {
    return null;
  }
}

export function parseModocIntelFromText(text: string): ModocIntelBlock | null {
  const match = text.match(INTEL_RE);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ModocIntelBlock;
  } catch {
    return null;
  }
}

/** Remove machine blocks but keep OBSERVATION / REASONING / ACTION headings for the VA UI. */
export function stripModocMachineBlocks(text: string): string {
  return text
    .replace(ACTION_RE, "")
    .replace(SUGGEST_RE, "")
    .replace(INTEL_RE, "")
    .replace(/^ACTION:\s*$/m, "")
    .replace(/^OBSERVE ONLY\s*$/m, "")
    .trim();
}

export function stripModocProtocolLines(text: string): string {
  return stripModocMachineBlocks(text)
    .replace(/^OBSERVATION:\s*[\s\S]*?(?=^REASONING:|$)/m, "")
    .replace(/^REASONING:\s*[\s\S]*?(?=^ACTION:|$)/m, "")
    .replace(/^ACTION:\s*[\s\S]*?(?=MODOC_|OBSERVE ONLY|$)/m, "")
    .trim();
}
