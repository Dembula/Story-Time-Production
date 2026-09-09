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
  return stripScreenplayPageFooters(
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\f/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\b(INT\.|EXT\.|INT\/EXT\.|I\/E\.)([A-Z])/g, "$1 $2")
      .replace(/([A-Z])-([A-Z])/g, "$1 - $2")
      .replace(/^\s*\d{1,3}\.?\s*$/gm, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim(),
  );
}

/**
 * Remove PDF page-break footers like (CONTINUED) / (MORE).
 * Does not touch character cues such as DEAN (CONT'D).
 */
export function stripScreenplayPageFooters(text: string): string {
  return text
    .replace(/^\s*(?:\(\s*)?(?:CONTINUED|MORE)\s*:?\s*(?:\)\s*)?(?:\d+\.?)?\s*$/gim, "")
    .replace(/^\s*(?:\(\s*CONTINUED\s*:?\s*\)\s*){1,}\s*$/gim, "")
    .replace(/\bCONTINUED:\s*\d+\.?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
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
  return singleChar / tokens.length >= 0.45;
}

/** Long runs with almost no spaces — words glued together. */
export function isRunTogetherGarbage(text: string): boolean {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const glued = lines.filter((l) => l.length >= 28 && (l.match(/ /g)?.length ?? 0) <= 1);
  return glued.length / lines.length >= 0.35;
}

/** Common compounds that appear when PDF extract drops spaces between short words. */
const GLUED_WORD_PAIRS: Array<[RegExp, string]> = [
  [/\bto(?=the\b)/gi, "to "],
  [/\bof(?=the\b)/gi, "of "],
  [/\bin(?=the\b)/gi, "in "],
  [/\bon(?=the\b)/gi, "on "],
  [/\bat(?=the\b)/gi, "at "],
  [/\band(?=the\b)/gi, "and "],
  [/\bfor(?=the\b)/gi, "for "],
  [/\bfrom(?=the\b)/gi, "from "],
  [/\binto(?=the\b)/gi, "into "],
  [/\bto(?=a\b)/gi, "to "],
  [/\bof(?=a\b)/gi, "of "],
  [/\bin(?=a\b)/gi, "in "],
  [/\bis(?=a\b)/gi, "is "],
  [/\bas(?=a\b)/gi, "as "],
  [/\bto(?=her\b)/gi, "to "],
  [/\bto(?=his\b)/gi, "to "],
  [/\bto(?=him\b)/gi, "to "],
  [/\bwith(?=the\b)/gi, "with "],
  [/\bholding(?=[A-Z][a-z])/g, "holding "],
  [/\bstanding(?=[A-Z][a-z])/g, "standing "],
  [/\blooking(?=[A-Z][a-z])/g, "looking "],
  [/\bsitting(?=[A-Z][a-z])/g, "sitting "],
  [/\bwatching(?=[A-Z][a-z])/g, "watching "],
  [/\bseeing(?=[A-Z][a-z])/g, "seeing "],
  [/\bcomes?(?=[A-Z][a-z])/g, "comes "],
];

/**
 * Detect partially readable extracts that still miss spaces inside words
 * (e.g. holdingMichaela, thereDALE:, tothe, DAYCROSS).
 */
export function isPartialWordGlueGarbage(text: string): boolean {
  const tokens = text.split(/\s+/).filter((t) => /[A-Za-z]{4,}/.test(t));
  if (tokens.length < 8) return false;

  let glued = 0;
  for (const token of tokens) {
    if (/[a-z][A-Z]/.test(token)) glued += 1;
    else if (/[a-z][.\-'][A-Z]/.test(token)) glued += 1;
    else if (/[a-z]{2,}[A-Z]{2,}/.test(token)) glued += 1;
    else if (/^(to|of|in|on|at|and|for|from|the|is|as)(the|a|an|her|his|him|them|this|that)/i.test(token)) {
      glued += 1;
    } else if (/(?:DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS)(CROSS|CUT|FADE|DISSOLVE)/i.test(token)) {
      glued += 1;
    } else if (/^[A-Z]{3,}:[A-Za-z]/.test(token)) {
      glued += 1;
    }
  }

  return glued / tokens.length >= 0.04 || glued >= 4;
}

/** Too few line breaks / structural cues for the amount of prose — wall-of-text PDF extract. */
export function hasCollapsedScreenplayStructure(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "").length;
  if (letters < 200) return false;
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  const avgLettersPerLine = letters / lines.length;
  if (avgLettersPerLine >= 90) return true;

  const structural = lines.filter((l) => {
    if (SCENE_HEADING.test(l)) return true;
    if (/^(FADE|CUT TO|DISSOLVE|CROSS\s*CUT)/i.test(l)) return true;
    if (/^[A-Z][A-Z0-9 .'\-]{1,36}(?:\s*\((?:V\.O\.?|O\.S\.?)\))?:?\s*$/.test(l)) return true;
    return false;
  }).length;

  if (letters > 600 && structural < 3) return true;
  if (letters > 1200 && structural < 5) return true;
  return false;
}

/** Extract should prefer vision OCR (readable but structurally broken / glued). */
export function prefersVisionOcrForScreenplay(text: string): boolean {
  if (!text.trim()) return true;
  if (isGarbledPdfExtraction(text)) return true;
  if (isPartialWordGlueGarbage(text)) return true;
  if (hasCollapsedScreenplayStructure(text)) return true;
  if (isRunTogetherGarbage(text)) return true;
  if (isCharacterSpacedGarbage(text)) return true;
  return scoreScreenplayLayout(text) < 40;
}

const COMMON_ENGLISH = new Set([
  "the", "and", "to", "of", "a", "in", "is", "it", "for", "on", "with", "that", "this",
  "he", "she", "they", "was", "are", "be", "as", "at", "or", "from", "by", "an", "have",
  "has", "had", "not", "but", "what", "when", "who", "how", "all", "can", "her", "his",
  "him", "you", "we", "me", "my", "your", "out", "up", "into", "about", "over", "after",
  "before", "then", "now", "just", "like", "there", "here", "been", "were", "said",
  "will", "would", "could", "should", "int", "ext", "day", "night", "fade", "cut",
  "black", "continued", "more", "cont", "door", "car", "inside", "look", "looks",
  "through", "window", "back", "down", "away", "comes", "goes", "gone", "sitting",
  "yard", "bonnet", "closed", "open", "opens", "walks", "stands", "turns",
]);

/**
 * Detect broken ToUnicode / CID font extraction: lots of letter tokens that aren't
 * real English/screenplay words (e.g. "SLhmic1Elt", "hoeohohye").
 */
export function isGarbledPdfExtraction(text: string): boolean {
  const tokens = text
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length < 18) return false;

  let commonHits = 0;
  let plausible = 0;
  let suspicious = 0;

  for (const token of tokens) {
    const lettersOnly = token.replace(/[^A-Za-z']/g, "");
    const lower = lettersOnly.toLowerCase();
    if (lower.length < 2) continue;

    if (COMMON_ENGLISH.has(lower)) {
      commonHits += 1;
      plausible += 1;
      continue;
    }

    const vowels = (lower.match(/[aeiouy]/g) ?? []).length;
    const vowelRatio = vowels / lower.length;
    let bad = false;

    if (lower.length >= 5 && vowelRatio < 0.18) bad = true;
    if (/\d/.test(token) && /[A-Za-z]{3,}/.test(token) && !/^(INT|EXT|I\/E)/i.test(token)) {
      bad = true;
    }
    if (/[a-z][A-Z][a-z]/.test(token) || /[A-Z]{2,}[a-z]{2,}[A-Z]/.test(token)) {
      bad = true;
    }
    if (/^[bcdfghjklmnpqrstvwxz]{4,}$/i.test(lower)) bad = true;
    // Odd mid-word capitalization / digit soup typical of CID dumps
    if (/[A-Z].*[a-z].*[A-Z]/.test(token) && token.length >= 5) bad = true;
    if (/[a-z]{2,}[A-Z]{2,}/.test(token)) bad = true;

    if (bad) {
      suspicious += 1;
    } else if (vowelRatio >= 0.2 && lower.length <= 16) {
      plausible += 1;
    } else if (lower.length <= 3 && vowelRatio > 0) {
      plausible += 1;
    } else {
      suspicious += 0.5;
    }
  }

  const considered = Math.max(commonHits + plausible + suspicious, tokens.length);
  const commonRatio = commonHits / tokens.length;
  const plausibleRatio = plausible / tokens.length;
  const susRatio = suspicious / considered;

  if (plausibleRatio < 0.45 && susRatio >= 0.25) return true;
  if (commonRatio < 0.08 && susRatio >= 0.22) return true;
  if (commonRatio < 0.05 && plausibleRatio < 0.55) return true;
  return false;
}

/** True when extract is unusable for editing — prefer OCR / another strategy. */
export function isUnusableScreenplayExtract(text: string): boolean {
  if (!text.trim()) return true;
  if (isGarbledPdfExtraction(text)) return true;
  if (isCharacterSpacedGarbage(text) && isGarbledPdfExtraction(repairCharacterSpacedText(text))) {
    return true;
  }
  // Glued / collapsed walls of text need OCR or heavy restructure — treat as unusable
  // for the "accept as-is" path so vision OCR is attempted first.
  if (isPartialWordGlueGarbage(text) || hasCollapsedScreenplayStructure(text)) return true;
  return scoreScreenplayLayout(text) < 15;
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
  if (isPartialWordGlueGarbage(cleaned)) score -= 180;
  if (hasCollapsedScreenplayStructure(cleaned)) score -= 120;
  if (isFragmentedScreenplayImport(cleaned)) score -= 30;
  if (isGarbledPdfExtraction(cleaned)) score -= 220;
  score -= countGluedTokens(tokens) * 15;

  // Reward real screenplay structure
  score += lines.filter((l) => /^[A-Z][A-Z0-9 .'\-]{1,36}:?\s*$/.test(l)).length * 8;

  return score;
}

/** Join single-character tokens on a line: "T h e r e" -> "There". */
function repairCharacterSpacedLine(line: string): string {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return line;

  const singleCharRatio = tokens.filter((t) => t.length === 1).length / tokens.length;
  if (singleCharRatio < 0.4) return line;

  let out = "";
  let buf = "";
  for (const token of tokens) {
    if (token.length === 1 && /[A-Za-z0-9'.,;:!?]/.test(token)) {
      if (/[.,;:!?]/.test(token) && buf) {
        out += (out ? " " : "") + buf + token;
        buf = "";
        continue;
      }
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

/**
 * Normalize imported screenplay text.
 * Always returns extractable text when letters exist — never discards content.
 */
export function normalizeImportedScreenplayLayout(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let normalized = lightCleanScreenplayText(text);
  if (!normalized) return { text: "", fixes };

  // Always attempt per-line glyph rejoin — mixed pages often fail the global spaced check.
  const rejoined = repairCharacterSpacedText(normalized);
  if (rejoined !== normalized) {
    normalized = rejoined;
    fixes.push("Rejoined character-spaced PDF glyphs");
  }

  if (isFragmentedScreenplayImport(normalized)) {
    normalized = repairFragmentedScreenplayText(normalized);
    fixes.push("Rebuilt screenplay lines from PDF word fragments");
  }

  const needsUnglue =
    isRunTogetherGarbage(normalized) ||
    isPartialWordGlueGarbage(normalized) ||
    hasCollapsedScreenplayStructure(normalized) ||
    /[a-z][A-Z]/.test(normalized) ||
    /\b[A-Z]{2,}:[A-Za-z]/.test(normalized);

  if (needsUnglue) {
    const restructured = restructureGluedScreenplay(normalized);
    if (restructured !== normalized) {
      normalized = restructured;
      fixes.push("Restored spaces and screenplay structure from glued PDF text");
    }
  }

  normalized = normalized.replace(/^(INT|EXT|I\/E)(?=\s)/gim, (match) => `${match.toUpperCase()}.`);

  return {
    text: lightCleanScreenplayText(normalized),
    fixes: [...new Set(fixes)].slice(0, 12),
  };
}

/** Expand "NAME: dialogue" / mid-line cues into standard character + dialogue lines. */
function expandColonCharacterCues(text: string): string {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      out.push("");
      continue;
    }

    // Full-line cue with dialogue: "DALE: hello there"
    const full = line.match(
      /^([A-Z][A-Z0-9 .'\-]{1,40}(?:\s*\((?:V\.O\.?|O\.S\.?|CONT'D|V\.O|O\.S)\))?)\s*:\s*(.+)$/,
    );
    if (full?.[1] && full[2]?.trim()) {
      const name = full[1].trim().replace(/:$/, "");
      const dialogue = full[2].trim();
      // Duplicate cue noise: "LISAKHANYA:LISAKHANYA: hi" already split once above
      if (/^[A-Z][A-Z0-9 .'\-]{1,40}:/.test(dialogue)) {
        out.push(name);
        out.push(...expandColonCharacterCues(dialogue).split("\n"));
      } else {
        out.push(name);
        out.push(dialogue);
      }
      continue;
    }

    // Cue-only line ending with colon
    if (/^[A-Z][A-Z0-9 .'\-]{1,40}(?:\s*\((?:V\.O\.?|O\.S\.?|CONT'D)\))?:\s*$/.test(line.trim())) {
      out.push(line.trim().replace(/:$/, ""));
      continue;
    }

    out.push(line);
  }
  return out.join("\n");
}

/**
 * Repair glued PDF/OCR extracts into readable screenplay lines.
 * Handles camelCase joins, NAME: cues, DAYCROSS, mid-line FADE TO BLACK, etc.
 */
export function restructureGluedScreenplay(text: string): string {
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (const [re, rep] of GLUED_WORD_PAIRS) {
    t = t.replace(re, rep);
  }

  // lowerUpper → space (holdingMichaela, thereDALE, ofDEAN)
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2");

  // ALLCAPS glued to following ALLCAPS transition/cue after time of day
  t = t.replace(
    /\b(DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|DAWN|DUSK|AFTERNOON)(CROSS\s*CUTS?|CROSSCUTS?|CUT\s*TO|FADE|DISSOLVE|SMASH)/gi,
    "$1\n\n$2",
  );

  // Mid-prose transitions
  t = t.replace(
    /\b(FADE TO BLACK|FADE OUT\.?|FADE IN:?|CUT TO BLACK|DISSOLVE TO:|CUT TO:|SMASH CUT TO:)\b/gi,
    "\n\n$1\n\n",
  );

  // Period/punct then glued character cue: seat.LISAKHANYA: / equilibriumDALE:
  t = t.replace(/([a-z0-9.,!?…"'”])\s*([A-Z]{2,}(?:\s*\([^)]{0,12}\))?\s*:)/g, "$1\n\n$2");

  // Word then glued cue without punct: there DALE: already spaced by camelCase; also NAME:NAME:
  t = t.replace(/([A-Z]{2,})\s*:\s*([A-Z]{2,})\s*:/g, "$1:\n\n$2:");

  // Scene heading should stand alone before following action/transition caps
  t = t.replace(
    /((?:INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|EST\.)[^\n]{3,80}?\b(?:DAY|NIGHT|MORNING|EVENING|LATER|CONTINUOUS|DAWN|DUSK|AFTERNOON))\s+(?=[A-Z])/gi,
    "$1\n\n",
  );

  // CROSS CUTS … as its own beat when stuck to prose
  t = t.replace(/\b(CROSS\s*CUTS?(?:\s+BACK(?:\s+TO)?)?)\b/gi, "\n\n$1\n\n");

  t = expandColonCharacterCues(t);

  // Ensure blank line before character cues that are alone on a line
  t = t.replace(
    /([^\n])\n([A-Z][A-Z0-9 .'\-]{1,40}(?:\s*\((?:V\.O\.?|O\.S\.?|CONT'D)\))?)\n/g,
    "$1\n\n$2\n",
  );

  t = t
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  return t;
}

/** Best-effort spaces for glued screenplay tokens (legacy helper). */
function unglueScreenplayText(text: string): string {
  return restructureGluedScreenplay(text);
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
