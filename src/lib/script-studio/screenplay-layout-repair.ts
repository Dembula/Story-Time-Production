/**
 * Repairs screenplay layout after PDF extraction (especially pdfTeX / per-word Tj output).
 * Safe to run on any imported text — no-ops when layout already looks correct.
 */

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|INT\/EXT\.|I\/E\.|EST\.)/i;

const TRANSITION_START = /^(FADE|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|WIPE TO)/i;

const SLUGLINE_TIME =
  /\b(DAY|NIGHT|CONTINUOUS|MORNING|EVENING|LATER|SAME|DUSK|DAWN|AFTERNOON)\b\.?$/i;

const CHARACTER_EXTENSIONS = /(\(V\.O\.\)|\(O\.S\.\)|\(CONT'D\)|\(V\.O\)|\(O\.S\))/i;

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
]);

export function isFragmentedScreenplayImport(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 8) return false;
  const singleToken = lines.filter((l) => !l.includes(" ") && l.length > 0).length;
  return singleToken / lines.length >= 0.45;
}

export function scoreScreenplayLayout(text: string): number {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;

  const multiWord = lines.filter((l) => l.includes(" ")).length;
  const sluglines = lines.filter((l) => SCENE_HEADING.test(l)).length;
  const fragmented = isFragmentedScreenplayImport(text) ? -80 : 0;

  return (multiWord / lines.length) * 100 + sluglines * 15 + fragmented;
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
        i++;
        if (tokens[i] === ".") {
          parts[0] = `${parts[0]}.`;
          i++;
        }
      } else {
        parts.push(tok);
        i++;
      }

      while (i < tokens.length) {
        const t = tokens[i]!;
        if (isSluglineStart(t) && parts.length > 1) break;
        if (isLikelyCharacterCue(t, tokens[i + 1]) && parts.length > 2) break;
        if (isTransitionStart(t)) break;
        parts.push(t);
        i++;
        if (SLUGLINE_TIME.test(t)) break;
        if (parts.length > 24) break;
      }

      out.push(mergeSluglineParts(parts));
      continue;
    }

    if (isTransitionStart(tok)) {
      const parts = [tok];
      i++;
      while (i < tokens.length && parts.join(" ").length < 32) {
        const t = tokens[i]!;
        if (isSluglineStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
        parts.push(t);
        i++;
        if (/BLACK|IN\.?$/i.test(t)) break;
      }
      out.push(parts.join(" ").replace(/\s+/g, " ").trim());
      continue;
    }

    if (isLikelyCharacterCue(tok, tokens[i + 1])) {
      let cue = tok;
      i++;
      if (tokens[i] === "(" && tokens[i + 1] && /^(V\.O\.|O\.S\.|CONT'D)\)?$/i.test(tokens[i + 1]!)) {
        cue += `(${tokens[i + 1]!.replace(/\)$/, "")})`;
        i += tokens[i] === ")" ? 1 : 2;
        if (tokens[i] === ")") i++;
      }

      out.push(cue);
      const dialogue: string[] = [];
      while (i < tokens.length) {
        const t = tokens[i]!;
        if (isSluglineStart(t) || isTransitionStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
        dialogue.push(t);
        i++;
      }
      if (dialogue.length) out.push(dialogue.join(" ").replace(/\s+/g, " ").trim());
      continue;
    }

    const action: string[] = [tok];
    i++;
    while (i < tokens.length) {
      const t = tokens[i]!;
      if (isSluglineStart(t) || isTransitionStart(t) || isLikelyCharacterCue(t, tokens[i + 1])) break;
      action.push(t);
      i++;
    }
    out.push(action.join(" ").replace(/\s+/g, " ").trim());
  }

  return out.filter(Boolean);
}

/** Merge one-word-per-line PDF output into screenplay lines. */
export function repairFragmentedScreenplayText(text: string): string {
  if (!isFragmentedScreenplayImport(text)) return text;

  const tokens = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const repaired = repairFragmentedTokens(tokens);
  return repaired.join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

/** Normalize imported screenplay: repair fragmentation, sluglines, spacing. */
export function normalizeImportedScreenplayLayout(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let normalized = text.replace(/\r\n/g, "\n").trim();

  if (isFragmentedScreenplayImport(normalized)) {
    normalized = repairFragmentedScreenplayText(normalized);
    fixes.push("Rebuilt screenplay lines from PDF word fragments");
  }

  const lines = normalized.split("\n");
  const repaired: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      repaired.push("");
      continue;
    }

    if (/^(INT|EXT|I\/E)\s/i.test(t) && !/^(INT\.|EXT\.|I\/E\.)/i.test(t)) {
      repaired.push(t.replace(/^(INT|EXT|I\/E)/i, (m) => `${m.toUpperCase()}.`));
      fixes.push("Repaired slugline punctuation");
      continue;
    }

    repaired.push(line);
  }

  normalized = repaired
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  return { text: normalized, fixes: [...new Set(fixes)].slice(0, 12) };
}
