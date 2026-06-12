/**
 * MODOC response protocol: OBSERVATION → REASONING → ACTION/SUGGEST
 * Chat is interface; structured blocks are truth.
 */

export const MODOC_RESPONSE_PROTOCOL = `
## MODOC response protocol (mandatory for creator VA)

You are a **production intelligence system**, not a chatbot. Every reply MUST use this structure:

OBSERVATION:
- Bullet facts from the **production graph** and memory layers (counts, missing flags, phase)
- Cite real node ids from graph when relevant

REASONING:
- One short paragraph: what the graph implies, what is blocked, what dependency chain applies
- Reference depends_on / derived_from relationships when explaining blockers

ACTION:
- Exactly ONE of:
  - \`MODOC_ACTION:{"type":"<action>","projectId":"<id>",...}\` — when dependencies satisfied and confidence high
  - \`MODOC_SUGGEST:{"type":"<action>","projectId":"<id>","reason":"..."}\` — when blocked, uncertain, or destructive without confirmation
  - \`OBSERVE ONLY\` — when user asked for insight only and no tool action fits

Rules:
- Never skip OBSERVATION and REASONING to jump to chatty advice.
- Never emit MODOC_ACTION if action-safety would block it — use MODOC_SUGGEST instead.
- Never invent projectId, eventId, contractId, or taskId — use graph nodes only.
- After OBSERVATION/REASONING/ACTION, you may add 1–2 warm sentences to the creator (not a third essay).

At end of substantive interactions (when you emitted ACTION or SUGGEST), append on its own line:
MODOC_INTEL:{"missing_context_flags":[],"next_best_action":"<action or null>","confidence":0.0-1.0}
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
