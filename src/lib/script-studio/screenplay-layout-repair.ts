/**
 * Screenplay import layout helpers.
 * Preserve good text. Repair broken PDF output. Never discard extractable letters.
 */

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|INT\/EXT\.|I\/E\.|EST\.)/i;

const TRANSITION_START = /^(FADE|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|WIPE TO)/i;

const SLUGLINE_TIME =
  /\b(DAY|NIGHT|CONTINUOUS|MORNING|EVENING|LATER|SAME|DUSK|DAWN|AFTERNOON)\b\.?$/i;

const CHARACTER_EXTENSIONS = /(\(V\.O\.?\)|\(O\.S\.?\)|\(CONT'D\)|\(V\.O\)|\(O\.S\))/i;

const COMMON_CAPS_WORDS = new Set([
  "INT",
  "EXT",
  "DAY",
  "NIGHT",
  "FADE",
  "CUT",
  "BLACK",
  "TO",
  "THE",
  "AND",
  "OF",
  "A",
  "AN",
  "IN",
  "ON",
  "AT",
  "WITH",
  "FROM",
  "SLOW",
  "MID",
  "LONG",
  "SHOT",
  "OFF",
  "UNIVERSITY",
  "ENTRANCE",
  "OFFICE",
  "DEANS",
  "CONTINUED",
]);

/** Light cleanup that never invents structure. */
export function lightCleanScreenplayText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\b(INT\.|EXT\.|INT\/EXT\.|I\/E\.)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])-([A-Z])/g, "$1 - $2")
    .replace(/^\s*(CONTINUED:|CONTINUED)\s*\d*\.?\s*$/gim, "")
    .replace(/\bCONTINUED:\s*\d+\.?\s*/gi, "")
    .replace(/^\s*\d{1,3}\.?\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function isFragmentedScreenplayImport(text: string): boolean {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 8) return false;
  const singleToken = lines.filter((l) => !l.includes(" ") && l.length > 0).length;
  return singleToken / lines.length >= 0.45;
}

/** Characters spaced like "T c s A h l o" — broken glyph extraction. */
export function isCharacterSpacedGarbage(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 20) return false;
  const singleChar = tokens.filter((t) => t.length === 1).length;
  return singleChar / tokens.length >= 0.55;
}

/** Long runs with almost no spaces — words glued together. */
export function isRunTogetherGarbage(text: string): boolean {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const glued = lines.filter((l) => l.length >= 28 && (l.match(/ /g)?.length ?? 0) <= 1);
  return glued.length / lines.length >= 0.35;
}

function countGluedTokens(tokens: string[]): number {
  return tokens.filter((token) => {
    if (/^(INT|EXT|I\/E)\.[A-Z]{3,}/i.test(token)) return true;
    if (/[a-z][A-Z]/.test(token)) return true;
    if (token.length >= 16 && !/[-–—']/.test(token)) return true;
    return false;
  }).length;
}

/** Score used only to rank extraction strategies — never to discard text. */
export function scoreScreenplayLayout(text: string): number {
  const cleaned = lightCleanScreenplayText(text);
  const lines = cleaned.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return -1000;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const letters = cleaned.replace(/[^A-Za-z]/g, "").length;
  if (letters < 8) return -1000;

  const spaces = (cleaned.match(/ /g) ?? []).length;
  const spaceRatio = spaces / Math.max(letters, 1);
  const avgTokenLen =
    tokens.reduce((sum, token) => sum + token.length, 0) / Math.max(tokens.length, 1);

  let score = letters * 0.05;
  score += (lines.filter((l) => l.includes(" ")).length / lines.length) * 100;
  score += lines.filter((l) => SCENE_HEADING.test(l)).length * 20;
  score += Math.min((cleaned.match(/\n\n/g) ?? []).length, 20);

  if (avgTokenLen >= 2.5 && avgTokenLen <= 10) score += 25;
  if (spaceRatio >= 0.12) score += 35;
  else if (spaceRatio >= 0.08) score += 10;
  else score -= 20;

  if (isCharacterSpacedGarbage(cleaned)) score -= 80;
  if (isRunTogetherGarbage(cleaned)) score -= 40;
  if (isFragmentedScreenplayImport(cleaned)) score -= 30;
  score -= countGluedTokens(tokens) * 15;

  return score;
}

/** Join single-character tokens on a line: "T h e r e" -> "There". */
function repairCharacterSpacedLine(line: string): string {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return line;

  const singleCharRatio = tokens.filter((t) => t.length === 1).length / tokens.length;
  if (singleCharRatio < 0.55) return line;

  let out = "";
  let buf = "";
  for (const token of tokens) {
    if (token.length === 1 && /[A-Za-z0-9'.,;:!?]/.test(token)) {
      buf += token;
      continue;
    }
    if (buf) {
      out += (out ? " " : "") + buf;
      buf = "";
    }
    out += (out ? " " : "") + token;
  }
  if (buf) out += (out ? " " : "") + buf;
  return out;
}

function repairCharacterSpacedText(text: string): string {
  return text
    .split("\n")
    .map((line) => repairCharacterSpacedLine(line))
    .join("\n");
}

/** Best-effort spaces for glued screenplay tokens. */
function unglueScreenplayText(text: string): string {
  return text
    .replace(/\b(INT\.|EXT\.|INT\/EXT\.|I\/E\.)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])-([A-Z])/g, "$1 - $2")
    .replace(/\b(DAY|NIGHT|CONTINUOUS|MORNING|EVENING|LATER|SAME|DUSK|DAWN)(?=[A-Z])/gi, "$1\n\n")
    .replace(/([a-z])([A-Z][A-Z])/g, "$1\n$2")
    .replace(/([.!?])([A-Z])/g, "$1 $2")
    .replace(/\b(FADE TO BLACK|CUT TO|DISSOLVE TO)\b/gi, "\n\n$1\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isSluglineStart(token: string): boolean {
  return SCENE_HEADING.test(token) || /^(INT|EXT|I\/E)$/i.test(token);
}

function isTransitionStart(token: string): boolean {
  return TRANSITION_START.test(token);
}

function isLikelyCharacterCue(token: string, next?: string): boolean {
  const t = token.trim();
  if (!t || t.length > 45) return false;
  if (SCENE_HEADING.test(t) || isTransitionStart(t)) return false;
  if (COMMON_CAPS_WORDS.has(t.toUpperCase())) return false;
  if (CHARACTER_EXTENSIONS.test(t)) return /^[A-Z][A-Z0-9'().\- ]+$/.test(t);
  if (!/^[A-Z][A-Z0-9'().\-]*$/.test(t)) return false;
  if (t.length < 3) return false;
  if (next && /^[a-z(]/.test(next)) return true;
  return false;
}

function mergeSluglineParts(parts: string[]): string {
  return parts
    .join(" ")
    .replace(/\s+\.\s+/g, ". ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^(INT|EXT|I\/E)\s+(?!\.)/i, (m) => `${m.trim()}. `)
    .trim();
}

function repairFragmentedTokens(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (isSluglineStart(tok)) {
      const parts: string[] = [];
      if (/^(INT|EXT|I\/E)$/i.test(tok)) {
        parts.push(tok.toUpperCase());
        i += 1;
        if (tokens[i] === ".") {
          parts[0] = `${parts[0]}.`;
          i += 1;
        }
      } else {
        parts.push(tok);
        i += 1;
      }

      while (i < tokens.length) {
        const t = tokens[i]!;
        if (isSluglineStart(t) && parts.length > 1) break;
        if (isLikelyCharacterCue(t, tokens[i + 1]) && parts.length > 2) break;
        if (isTransitionStart(t)) break;
        parts.push(t);
        i += 1;
        if (SLUGLINE_TIME.test(t)) break;
        if (parts.length > 24) break;
      }

      out.push(mergeSluglineParts(parts));
      continue;
    }

    if (isTransitionStart(tok)) {
      const parts = [tok];
      i += 1;
      while (i < tokens.length && parts.join(" ").length < 32) {
        const t = tokens[i]!;
        if (isSluglineStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
        parts.push(t);
        i += 1;
        if (/BLACK|IN\.?$/i.test(t)) break;
      }
      out.push(parts.join(" ").replace(/\s+/g, " ").trim());
      continue;
    }

    if (isLikelyCharacterCue(tok, tokens[i + 1])) {
      let cue = tok;
      i += 1;
      if (tokens[i] === "(" && tokens[i + 1] && /^(V\.O\.?|O\.S\.?|CONT'D)\)?$/i.test(tokens[i + 1]!)) {
        cue += ` (${tokens[i + 1]!.replace(/\)$/, "")})`;
        i += tokens[i] === ")" ? 1 : 2;
        if (tokens[i] === ")") i += 1;
      } else if (CHARACTER_EXTENSIONS.test(cue) && !cue.includes(" ")) {
        cue = cue.replace(CHARACTER_EXTENSIONS, " $1");
      }

      out.push(cue.trim());
      const dialogue: string[] = [];
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (isSluglineStart(t) || isTransitionStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
        dialogue.push(t);
        i += 1;
      }
      if (dialogue.length) out.push(dialogue.join(" ").replace(/\s+/g, " ").trim());
      continue;
    }

    const action: string[] = [tok];
    i += 1;
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (isSluglineStart(t) || isTransitionStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
      action.push(t);
      i += 1;
    }
    out.push(action.join(" ").replace(/\s+/g, " ").trim());
  }

  return out.filter(Boolean);
}

/** Merge one-word-per-line PDF output into screenplay lines. */
export function repairFragmentedScreenplayText(text: string): string {
  const tokens = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (tokens.length < 8) return text;
  return repairFragmentedTokens(tokens).join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

/**
 * Normalize imported screenplay text.
 * Always returns extractable text when letters exist — never discards content.
 */
export function normalizeImportedScreenplayLayout(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let normalized = lightCleanScreenplayText(text);
  if (!normalized) return { text: "", fixes };

  if (isCharacterSpacedGarbage(normalized)) {
    normalized = repairCharacterSpacedText(normalized);
    fixes.push("Rejoined character-spaced PDF glyphs");
  }

  if (isFragmentedScreenplayImport(normalized)) {
    normalized = repairFragmentedScreenplayText(normalized);
    fixes.push("Rebuilt screenplay lines from PDF word fragments");
  } else if (isRunTogetherGarbage(normalized)) {
    normalized = unglueScreenplayText(normalized);
    fixes.push("Inserted missing spaces in glued PDF text");
  }

  normalized = normalized.replace(/^(INT|EXT|I\/E)(?=\s)/gim, (match) => `${match.toUpperCase()}.`);

  return {
    text: lightCleanScreenplayText(normalized),
    fixes: [...new Set(fixes)].slice(0, 12),
  };
}
