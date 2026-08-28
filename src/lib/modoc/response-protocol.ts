/**
 * MODOC response protocol: structured actions behind the scenes; human prose for creators.
 */

export const MODOC_RESPONSE_PROTOCOL = `
## MODOC response protocol — internal structure (never show headers to the user)

When you need to execute platform workflows, think through facts and dependencies **internally**. Your **visible reply** must always be warm, human prose (see Human Voice guidelines).

**User-visible message:** Plain language only — no OBSERVATION / REASONING / ACTION headings.

**System-only lines** (append after your human reply when needed):
- \`MODOC_ACTION:{"type":"<action>","projectId":"<id>",...}\` — dependencies satisfied
- \`MODOC_SUGGEST:{"type":"<action>","projectId":"<id>","reason":"..."}\` — blocked or needs confirmation
- \`MODOC_INTEL:{"missing_context_flags":[],"next_best_action":"<action or null>","confidence":0.0-1.0}\` — optional intel for substantive production actions

Rules:
- Never invent projectId, eventId, contractId, or taskId — use graph nodes only.
- Never emit MODOC_ACTION if action-safety would block — use MODOC_SUGGEST.
- If you only need to advise (no action), skip machine lines entirely.
`;

export const MODOC_CONVERSATIONAL_PROTOCOL = `
## Conversational responses (default for creators)

**Default to natural, human prose** — the way a colleague would write in Slack or email.

- **Do NOT** use OBSERVATION / REASONING / ACTION headers in user-facing text.
- Answer directly with clear structure: short intro → what's working → gaps → offer to help.
- Be as capable as a leading general AI assistant on non-platform topics.
- If web search results are in context, synthesise them and label external sources.
- For legal/medical/tax binding decisions: informational guidance + professional-review caveat.
- Mention Story Time features when they genuinely help — don't force workflow jargon.
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

/** Remove machine blocks from assistant text shown in the VA UI. */
export function stripModocMachineBlocks(text: string): string {
  return text
    .replace(ACTION_RE, "")
    .replace(SUGGEST_RE, "")
    .replace(INTEL_RE, "")
    .replace(/^ACTION:\s*$/m, "")
    .replace(/^OBSERVE ONLY\s*$/m, "")
    .trim();
}

/** Remove OBSERVATION/REASONING blocks and machine lines for creator-facing display. */
export function stripModocProtocolLines(text: string): string {
  return stripModocMachineBlocks(text)
    .replace(/^OBSERVATION:\s*[\s\S]*?(?=^REASONING:|$)/m, "")
    .replace(/^REASONING:\s*[\s\S]*?(?=^ACTION:|$)/m, "")
    .replace(/^ACTION:\s*[\s\S]*?(?=MODOC_|OBSERVE ONLY|$)/m, "")
    .trim();
}

