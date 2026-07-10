import type { ScreenplayElementType } from "./types";
import {
  SCREENPLAY_COL,
  SCREENPLAY_LINE_WIDTH,
  getElementSnippet,
} from "./elements";

export const LINES_PER_PAGE = 55;
export const PAGE_GAP_PX = 36;

/** Tab / Shift+Tab cycle order for core screenplay elements. */
export const TAB_CYCLE: ScreenplayElementType[] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
  "shot",
  "centered",
];

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|EST\.)/i;
const SCENE_HEADING_START = /^(int\.?|ext\.?|i\/e\.?|est\.?)/i;
const TRANSITION_START = /^(FADE|CUT|DISSOLVE|SMASH|MATCH|WIPE|IRIS|JUMP|CROSSFADE)/i;
const TRANSITION_END = /(TO:|:|\.)$/;
const CHARACTER_LINE = /^[A-Z][A-Z0-9 .'\-()]{0,42}$/;
const SHOT_LINE =
  /^(CLOSE UP|EXTREME CLOSE UP|WIDE SHOT|MEDIUM SHOT|INSERT|POV|OVERHEAD|TRACKING SHOT|AERIAL SHOT|HANDHELD|STEADICAM|CRANE SHOT|DRONE SHOT|OVER THE SHOULDER)\b/i;

const UPPERCASE_ELEMENTS = new Set<ScreenplayElementType>([
  "scene_heading",
  "character",
  "transition",
  "shot",
]);

export function padColumn(text: string, column: number): string {
  return " ".repeat(Math.max(0, column)) + text.trimEnd();
}

function rightAlign(text: string, width = SCREENPLAY_LINE_WIDTH): string {
  const trimmed = text.trim();
  const pad = Math.max(0, width - trimmed.length);
  return " ".repeat(pad) + trimmed;
}

function centerText(text: string, width = SCREENPLAY_LINE_WIDTH): string {
  const trimmed = text.trim();
  const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
  return " ".repeat(pad) + trimmed;
}

export function leadingSpaces(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lineIndexAt(content: string, pos: number): number {
  return content.slice(0, pos).split("\n").length - 1;
}

export function lineStartAt(content: string, lineIndex: number): number {
  const lines = content.split("\n");
  let start = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    start += (lines[i]?.length ?? 0) + 1;
  }
  return start;
}

export function isEffectivelyEmptyLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed === "()";
}

export function detectLineElement(
  line: string,
  neighbors?: { prev?: string; next?: string },
): ScreenplayElementType {
  const trimmed = line.trim();
  if (!trimmed) return "action";

  const indent = leadingSpaces(line);

  if (SCENE_HEADING.test(trimmed)) return "scene_heading";

  if (
    (TRANSITION_START.test(trimmed) && TRANSITION_END.test(trimmed)) ||
    (indent >= 32 && TRANSITION_END.test(trimmed))
  ) {
    return "transition";
  }

  if (SHOT_LINE.test(trimmed) && indent < SCREENPLAY_COL.dialogue) return "shot";

  if (trimmed.startsWith("(") && (trimmed.endsWith(")") || !trimmed.includes(")"))) {
    return "parenthetical";
  }

  const nextTrim = neighbors?.next?.trim() ?? "";
  const nameOnly = trimmed.replace(/\s*\((V\.O\.|O\.S\.|CONT'D|OFF|PRE-LAP)\)\s*$/i, "").trim();

  if (
    CHARACTER_LINE.test(nameOnly) &&
    !SCENE_HEADING.test(nameOnly) &&
    !TRANSITION_START.test(nameOnly) &&
    !SHOT_LINE.test(nameOnly)
  ) {
    const atCharacterCol =
      indent >= SCREENPLAY_COL.character - 3 && indent <= SCREENPLAY_COL.character + 6;
    const nextIsDialogue =
      nextTrim.startsWith("(") ||
      (nextTrim.length > 0 && !SCENE_HEADING.test(nextTrim) && !CHARACTER_LINE.test(nextTrim));
    if (atCharacterCol || (nextIsDialogue && indent >= SCREENPLAY_COL.character - 6)) {
      return "character";
    }
  }

  if (
    indent >= SCREENPLAY_COL.dialogue - 2 &&
    indent <= SCREENPLAY_COL.dialogue + 8 &&
    !CHARACTER_LINE.test(trimmed)
  ) {
    return "dialogue";
  }

  // Centered titles: roughly middle of the line, short uppercase phrases
  if (
    indent >= 18 &&
    indent <= 28 &&
    trimmed.length <= 40 &&
    trimmed === trimmed.toUpperCase() &&
    !CHARACTER_LINE.test(nameOnly)
  ) {
    return "centered";
  }

  return "action";
}

export function resolveLineElement(
  line: string,
  neighbors: { prev?: string; next?: string } | undefined,
  activeElement?: ScreenplayElementType,
): ScreenplayElementType {
  const detected = detectLineElement(line, neighbors);
  if (!activeElement) return detected;

  const trimmed = line.trim();
  if (!trimmed) return activeElement;

  // Smart switches while typing
  if (trimmed.startsWith("(") && activeElement !== "character") return "parenthetical";
  if (SCENE_HEADING_START.test(trimmed) && activeElement === "action") return "scene_heading";
  if (TRANSITION_START.test(trimmed) && /^(cut|fade|dissolve|smash|match|wipe|jump|iris)/i.test(trimmed)) {
    if (activeElement === "action" || activeElement === "transition") return "transition";
  }

  if (activeElement === "character" || activeElement === "parenthetical" || activeElement === "dialogue") {
    const indent = leadingSpaces(line);
    if (activeElement === "character") {
      if (indent >= SCREENPLAY_COL.dialogue && indent < SCREENPLAY_COL.character - 2) {
        return detected;
      }
      return "character";
    }
    if (activeElement === "parenthetical" && trimmed.startsWith("(")) return "parenthetical";
    if (activeElement === "dialogue" && indent >= SCREENPLAY_COL.dialogue - 2) return "dialogue";
  }

  if (activeElement === "scene_heading" && SCENE_HEADING.test(trimmed)) return "scene_heading";
  if (activeElement === "transition") return detected === "transition" ? "transition" : activeElement;
  if (activeElement === "shot") return "shot";
  if (activeElement === "centered") return "centered";

  return detected;
}

export function formatLineForElement(element: ScreenplayElementType, rawLine: string): string {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    if (element === "dialogue") return padColumn("", SCREENPLAY_COL.dialogue);
    if (element === "character") return padColumn("", SCREENPLAY_COL.character);
    if (element === "parenthetical") return padColumn("()", SCREENPLAY_COL.parenthetical);
    return "";
  }

  switch (element) {
    case "scene_heading":
      return trimmed.toUpperCase();
    case "character": {
      const upper = trimmed.toUpperCase();
      return padColumn(upper, SCREENPLAY_COL.character);
    }
    case "parenthetical": {
      const inner = trimmed.replace(/^\(+|\)+$/g, "").trim();
      return padColumn(`(${inner})`, SCREENPLAY_COL.parenthetical);
    }
    case "dialogue":
      return padColumn(trimmed, SCREENPLAY_COL.dialogue);
    case "transition": {
      let t = trimmed.toUpperCase();
      if (!/[:.]$/.test(t) && /TO$/i.test(t)) t = `${t}:`;
      return rightAlign(t);
    }
    case "shot":
      return trimmed.toUpperCase();
    case "centered":
    case "lyrics":
      return centerText(trimmed);
    case "action":
    default:
      // Preserve trailing spaces while typing; only strip leading indent noise
      return rawLine.replace(/^\s+/, "");
  }
}

/** Max printable characters for the element body (excluding leading indent spaces). */
export function maxContentWidthForElement(element: ScreenplayElementType): number {
  switch (element) {
    case "dialogue":
      return SCREENPLAY_COL.dialogueWidth;
    case "parenthetical":
      return 25;
    case "character":
      return 35;
    case "transition":
      return 40;
    case "centered":
    case "lyrics":
      return 40;
    default:
      return SCREENPLAY_LINE_WIDTH;
  }
}

export function indentForElement(element: ScreenplayElementType): number {
  switch (element) {
    case "dialogue":
      return SCREENPLAY_COL.dialogue;
    case "parenthetical":
      return SCREENPLAY_COL.parenthetical;
    case "character":
      return SCREENPLAY_COL.character;
    default:
      return 0;
  }
}

/** Wrap plain text to a max width, preferring word boundaries. Never emits empty lines. */
export function wrapPlainText(text: string, maxWidth: number): string[] {
  const width = Math.max(8, maxWidth); // never allow tiny widths that peel single characters
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [""];
  if (normalized.length <= width) return [normalized];

  const lines: string[] = [];
  let rest = normalized;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    // Only break on a space if it isn't near the start (avoid 1–2 char leftovers from early spaces)
    if (cut < Math.floor(width * 0.5)) cut = width;
    const piece = rest.slice(0, cut).trimEnd();
    if (!piece) {
      // Safety: force a hard cut so we cannot infinite-loop
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
      continue;
    }
    lines.push(piece);
    rest = rest.slice(cut).trimStart();
  }
  if (rest) lines.push(rest);
  return lines.length ? lines : [""];
}

/**
 * Format + hard-wrap a line into one or more page-safe lines.
 * Dialogue/parenthetical/character keep their column indent on every wrapped row.
 */
export function hardWrapLineForElement(element: ScreenplayElementType, rawLine: string): string[] {
  if (element === "transition") {
    return [formatLineForElement(element, rawLine)];
  }

  let body = rawLine.trim();
  if (!body) return [formatLineForElement(element, "")];

  if (element === "parenthetical") {
    body = body.replace(/^\(+|\)+$/g, "").trim();
  } else if (UPPERCASE_ELEMENTS.has(element)) {
    body = body.toUpperCase();
  }

  const maxWidth = maxContentWidthForElement(element);
  const chunks = wrapPlainText(body, maxWidth);
  const indent = indentForElement(element);

  return chunks.map((chunk, index) => {
    if (element === "parenthetical") {
      const text =
        chunks.length === 1 ? `(${chunk})` : index === 0 ? `(${chunk}` : index === chunks.length - 1 ? `${chunk})` : chunk;
      return padColumn(text, indent);
    }
    if (element === "centered" || element === "lyrics") return centerText(chunk);
    if (indent > 0) return padColumn(chunk, indent);
    if (element === "scene_heading" || element === "shot" || element === "character") return chunk.toUpperCase();
    return chunk;
  });
}

/** Rejoin hard-wrapped fragments so re-wrapping while typing doesn't peel one char per keystroke. */
function joinWrapFragments(fragments: string[], maxWidth: number): string {
  if (fragments.length === 0) return "";
  const hardBrokenRun = fragments[0]!.trim().length >= maxWidth;
  let result = fragments[0]!.trim();
  for (let i = 1; i < fragments.length; i++) {
    const prev = fragments[i - 1]!.trim();
    const next = fragments[i]!.trim();
    if (!next) continue;
    // Full-width start (or previous) ⇒ hard break mid-token ⇒ concatenate with no space
    if (hardBrokenRun || prev.length >= maxWidth) result += next;
    else result += `${result.endsWith(" ") ? "" : " "}${next}`;
  }
  return result;
}

/**
 * Apply hard-wrap to the line under the cursor.
 * When typing at end of a full line, absorbs following short remainder lines first
 * so characters are not peeled onto their own lines one keystroke at a time.
 */
export function applyHardWrapAtCursor(
  content: string,
  cursorPos: number,
  activeElement: ScreenplayElementType,
): { content: string; selectionStart: number; selectionEnd: number; element: ScreenplayElementType } {
  const lineIdx = lineIndexAt(content, cursorPos);
  const lines = content.split("\n");
  const current = lines[lineIdx] ?? "";
  const neighbors = {
    prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
    next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
  };
  const element = resolveLineElement(current, neighbors, activeElement);
  const maxWidth = maxContentWidthForElement(element);
  const lineStart = lineStartAt(content, lineIdx);
  const cursorInLine = Math.max(0, cursorPos - lineStart);
  const atEnd = cursorInLine >= current.length;

  // Absorb peeled remainder lines when continuing to type at the end of a wrapped run
  let endIdx = lineIdx;
  if (atEnd) {
    const bodyLen = current.trim().length;
    if (bodyLen >= maxWidth) {
      while (endIdx + 1 < lines.length) {
        const nextLine = lines[endIdx + 1] ?? "";
        if (!nextLine.trim()) break;
        const nextEl = resolveLineElement(
          nextLine,
          {
            prev: lines[endIdx],
            next: endIdx + 2 < lines.length ? lines[endIdx + 2] : undefined,
          },
          element,
        );
        if (nextEl !== element) break;
        if (nextLine.trim().length >= maxWidth) break;
        endIdx += 1;
      }
    }
  }

  const fragmentBodies = lines.slice(lineIdx, endIdx + 1).map((l) => l.trim());
  const joinedBody =
    endIdx > lineIdx ? joinWrapFragments(fragmentBodies, maxWidth) : current.trim().length ? current.trim() : current;
  const sourceForWrap = joinedBody.length > 0 ? joinedBody : current;
  const wrapped = hardWrapLineForElement(element, sourceForWrap);

  // If nothing exceeded the width, keep a single formatted line (avoid churn)
  if (wrapped.length === 1 && endIdx === lineIdx && wrapped[0] === current) {
    return {
      content,
      selectionStart: cursorPos,
      selectionEnd: cursorPos,
      element,
    };
  }

  const before = lines.slice(0, lineIdx);
  const after = lines.slice(endIdx + 1);
  const newLines = [...before, ...wrapped, ...after];
  const newContent = newLines.join("\n");

  // Typing at end ⇒ caret always at end of last wrapped segment (Word-like)
  if (atEnd) {
    const lastLineIdx = lineIdx + wrapped.length - 1;
    const lastLine = wrapped[wrapped.length - 1] ?? "";
    const selectionStart = lineStartAt(newContent, lastLineIdx) + lastLine.length;
    return {
      content: newContent,
      selectionStart,
      selectionEnd: selectionStart,
      element,
    };
  }

  // Map caret through wrapped body characters (ignore indent spaces for mapping)
  const bodyCursor = Math.max(0, cursorInLine - indentForElement(element));
  let remaining = bodyCursor;
  let targetLine = lineIdx;
  let offsetInLine = 0;
  for (let i = 0; i < wrapped.length; i++) {
    const body = wrapped[i]!.trimEnd();
    const bodyLen = body.trim().length || body.length;
    const indent = indentForElement(element);
    if (remaining <= bodyLen || i === wrapped.length - 1) {
      targetLine = lineIdx + i;
      offsetInLine = indent + Math.min(remaining, bodyLen);
      break;
    }
    remaining -= bodyLen;
  }

  const selectionStart = lineStartAt(newContent, targetLine) + Math.max(0, offsetInLine);
  return {
    content: newContent,
    selectionStart,
    selectionEnd: selectionStart,
    element,
  };
}

/**
 * Final Draft–style Enter:
 * - empty Action → Character
 * - empty Dialogue → Action
 * - Character → Parenthetical
 * - Parenthetical → Dialogue
 * - Scene Heading → Action
 * - Transition → Scene Heading
 * - Shot / Centered → Action
 * - non-empty Action / Dialogue → continue same element
 */
export function nextElementOnEnter(
  current: ScreenplayElementType,
  currentLineEmpty: boolean,
): ScreenplayElementType {
  switch (current) {
    case "scene_heading":
      return "action";
    case "character":
      return "parenthetical";
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return currentLineEmpty ? "action" : "dialogue";
    case "transition":
      return "scene_heading";
    case "shot":
    case "centered":
    case "lyrics":
      return "action";
    case "action":
      return currentLineEmpty ? "character" : "action";
    default:
      return "action";
  }
}

export function cycleElement(
  current: ScreenplayElementType,
  direction: 1 | -1,
): ScreenplayElementType {
  const idx = TAB_CYCLE.indexOf(current);
  const base = idx >= 0 ? idx : TAB_CYCLE.indexOf("action");
  const next = (base + direction + TAB_CYCLE.length) % TAB_CYCLE.length;
  return TAB_CYCLE[next]!;
}

export function capitalizeCharacterFirstMention(content: string, characterLine: string): string {
  const base = characterLine
    .trim()
    .replace(/\s*\((V\.O\.|O\.S\.|CONT'D|OFF|PRE-LAP)\)\s*$/i, "")
    .trim();
  if (!base || base.length < 2) return content;

  const parts = base.split(/\s+/).filter(Boolean);
  const titleName = parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const firstName = parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1).toLowerCase();

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const el = detectLineElement(lines[i]!);
    if (el !== "action") continue;
    const line = lines[i]!;
    for (const candidate of [base, base.toLowerCase(), firstName.toLowerCase(), firstName]) {
      const re = new RegExp(`\\b${escapeRegex(candidate)}\\b`, "i");
      if (re.test(line)) {
        lines[i] = line.replace(re, parts.length > 1 ? titleName : firstName);
        return lines.join("\n");
      }
    }
  }
  return content;
}

export type ScreenplayKeyResult = {
  content: string;
  selectionStart: number;
  selectionEnd: number;
  element: ScreenplayElementType;
};

/** Live-format the current line while typing (caps, columns, hard-wrap, smart switches). */
export function formatLineWhileTyping(
  content: string,
  cursorPos: number,
  activeElement: ScreenplayElementType,
): { content: string; selectionStart: number; selectionEnd: number; element?: ScreenplayElementType } | null {
  const lineIdx = lineIndexAt(content, cursorPos);
  const lines = content.split("\n");
  const current = lines[lineIdx] ?? "";
  const neighbors = {
    prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
    next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
  };
  const element = resolveLineElement(current, neighbors, activeElement);

  const maxWidth = maxContentWidthForElement(element);
  const bodyLen = current.trim().length;
  const lineStart = lineStartAt(content, lineIdx);
  const atEnd = cursorPos >= lineStart + current.length;
  const nextBody = (lines[lineIdx + 1] ?? "").trim();
  const hasPeeledTail =
    atEnd &&
    bodyLen >= maxWidth &&
    nextBody.length > 0 &&
    nextBody.length < maxWidth &&
    resolveLineElement(lines[lineIdx + 1] ?? "", { prev: current, next: lines[lineIdx + 2] }, element) === element;

  const needsWrap = bodyLen > maxWidth || hasPeeledTail;
  const formattedSingle = formatLineForElement(element, current);
  const needsFormat =
    element !== "action" && (formattedSingle !== current || element !== activeElement);

  if (!needsWrap && !needsFormat) return null;

  if (needsWrap) {
    return applyHardWrapAtCursor(content, cursorPos, activeElement);
  }

  const lineEnd = lineStart + current.length;
  const cursorInLine = cursorPos - lineStart;
  const newContent = content.slice(0, lineStart) + formattedSingle + content.slice(lineEnd);
  const delta = formattedSingle.length - current.length;

  let newCursor = Math.max(lineStart, Math.min(lineStart + cursorInLine + delta, lineStart + formattedSingle.length));
  if (element === "parenthetical" && formattedSingle.includes("(")) {
    const open = formattedSingle.indexOf("(");
    const close = formattedSingle.lastIndexOf(")");
    if (close > open) {
      newCursor = Math.min(Math.max(lineStart + open + 1, newCursor), lineStart + close);
    }
  }

  return {
    content: newContent,
    selectionStart: newCursor,
    selectionEnd: newCursor,
    element,
  };
}

/** Format current line and insert the next element line on Enter. */
export function handleScreenplayEnter(
  content: string,
  cursorPos: number,
  activeElement?: ScreenplayElementType,
): ScreenplayKeyResult {
  const lineIdx = lineIndexAt(content, cursorPos);
  let lines = content.split("\n");
  const prev = lineIdx > 0 ? lines[lineIdx - 1] : undefined;
  const current = lines[lineIdx] ?? "";
  const next = lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined;

  const currentElement = resolveLineElement(current, { prev, next }, activeElement);
  const lineEmpty = isEffectivelyEmptyLine(current);

  let working = content;
  if (currentElement === "character" && !lineEmpty) {
    working = capitalizeCharacterFirstMention(working, current);
    lines = working.split("\n");
  }

  // Empty line: don't keep placeholder formatting — clear then advance
  if (!lineEmpty) {
    lines[lineIdx] = formatLineForElement(currentElement, lines[lineIdx] ?? current);
  } else if (currentElement === "action" || currentElement === "dialogue") {
    lines[lineIdx] = "";
  } else {
    lines[lineIdx] = formatLineForElement(currentElement, lines[lineIdx] ?? current);
  }

  const nextElement = nextElementOnEnter(currentElement, lineEmpty);
  const insertLines: string[] = [];

  if (nextElement === "parenthetical") {
    insertLines.push(padColumn("()", SCREENPLAY_COL.parenthetical));
  } else if (nextElement === "dialogue") {
    insertLines.push(padColumn("", SCREENPLAY_COL.dialogue));
  } else if (nextElement === "character") {
    // Double-Enter from empty action: replace empty line with character column
    if (lineEmpty && currentElement === "action") {
      lines[lineIdx] = padColumn("", SCREENPLAY_COL.character);
      const newLines = [...lines.slice(0, lineIdx + 1), ...lines.slice(lineIdx + 1)];
      const newContent = newLines.join("\n");
      const sel = lineStartAt(newContent, lineIdx) + SCREENPLAY_COL.character;
      return {
        content: newContent,
        selectionStart: sel,
        selectionEnd: sel,
        element: "character",
      };
    }
    insertLines.push(padColumn("", SCREENPLAY_COL.character));
  } else if (nextElement === "scene_heading") {
    insertLines.push("", "INT. LOCATION - DAY");
  } else if (nextElement === "action" && (currentElement === "dialogue" || currentElement === "scene_heading" || currentElement === "transition" || currentElement === "shot" || currentElement === "centered")) {
    if (lineEmpty && currentElement === "dialogue") {
      // Double-Enter from empty dialogue: clear indent and go to action
      lines[lineIdx] = "";
      const newLines = [...lines.slice(0, lineIdx + 1), "", ...lines.slice(lineIdx + 1)];
      const newContent = newLines.join("\n");
      const sel = lineStartAt(newContent, lineIdx + 1);
      return {
        content: newContent,
        selectionStart: sel,
        selectionEnd: sel,
        element: "action",
      };
    }
    insertLines.push("", "");
  } else if (nextElement === "action" && currentElement === "action") {
    insertLines.push("");
  } else {
    insertLines.push("");
  }

  const newLines = [...lines.slice(0, lineIdx + 1), ...insertLines, ...lines.slice(lineIdx + 1)];
  const newContent = newLines.join("\n");

  const insertStart = lineStartAt(newContent, lineIdx + 1);
  let selectionStart = insertStart;
  let selectionEnd = insertStart;

  if (nextElement === "parenthetical") {
    const parenLine = newLines[lineIdx + 1] ?? "";
    const open = parenLine.indexOf("(");
    selectionStart = insertStart + (open >= 0 ? open + 1 : SCREENPLAY_COL.parenthetical + 1);
    selectionEnd = selectionStart;
  } else if (nextElement === "dialogue") {
    selectionStart = insertStart + SCREENPLAY_COL.dialogue;
    selectionEnd = selectionStart;
  } else if (nextElement === "character") {
    selectionStart = insertStart + SCREENPLAY_COL.character;
    selectionEnd = selectionStart;
  } else if (nextElement === "scene_heading") {
    const slugStart = lineStartAt(newContent, lineIdx + 2);
    selectionStart = slugStart + 5;
    selectionEnd = slugStart + 13;
  } else if (nextElement === "action" && currentElement !== "action") {
    const actionLineStart = lineStartAt(newContent, lineIdx + (insertLines.length > 1 ? 2 : 1));
    selectionStart = actionLineStart;
    selectionEnd = actionLineStart;
  }

  return {
    content: newContent,
    selectionStart,
    selectionEnd,
    element: nextElement,
  };
}

/** Reformat the current line as the next element in the Tab cycle. */
export function handleScreenplayTab(
  content: string,
  cursorPos: number,
  direction: 1 | -1 = 1,
  activeElement?: ScreenplayElementType,
): ScreenplayKeyResult {
  const lineIdx = lineIndexAt(content, cursorPos);
  const lines = content.split("\n");
  const current = lines[lineIdx] ?? "";
  const element = resolveLineElement(
    current,
    {
      prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
      next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
    },
    activeElement,
  );
  const nextElement = cycleElement(element, direction);
  const placeholder = SCREENPLAY_ELEMENT_PLACEHOLDER[nextElement] ?? "";
  const formatted = formatLineForElement(nextElement, current.trim() ? current : placeholder);

  const lineStart = lineStartAt(content, lineIdx);
  const lineEnd = lineStart + current.length;
  const newContent = content.slice(0, lineStart) + formatted + content.slice(lineEnd);

  let selStart = lineStart;
  let selEnd = lineStart + formatted.length;

  if (!current.trim()) {
    const snippet = getElementSnippet(nextElement);
    if (snippet.select) {
      selStart = lineStart + snippet.select.start;
      selEnd = lineStart + snippet.select.end;
    } else if (nextElement === "parenthetical") {
      const open = formatted.indexOf("(");
      selStart = lineStart + (open >= 0 ? open + 1 : formatted.length);
      selEnd = selStart;
    } else {
      selStart = lineStart + formatted.length;
      selEnd = selStart;
    }
  } else {
    selStart = lineStart + formatted.length;
    selEnd = selStart;
  }

  return {
    content: newContent,
    selectionStart: selStart,
    selectionEnd: selEnd,
    element: nextElement,
  };
}

const SCREENPLAY_ELEMENT_PLACEHOLDER: Partial<Record<ScreenplayElementType, string>> = {
  scene_heading: "INT. LOCATION - DAY",
  action: "Action.",
  character: "CHARACTER",
  parenthetical: "beat",
  dialogue: "Dialogue.",
  transition: "CUT TO:",
  shot: "CLOSE UP",
  centered: "THE END",
};

export function paginateLineIndices(content: string): number[] {
  const lineCount = content.split("\n").length;
  const breaks: number[] = [];
  for (let i = LINES_PER_PAGE; i < lineCount; i += LINES_PER_PAGE) {
    breaks.push(i);
  }
  return breaks;
}

export function pageCountForContent(content: string): number {
  return Math.max(1, Math.ceil(content.split("\n").length / LINES_PER_PAGE));
}

/**
 * Hard-wrap overflowing lines. Does NOT use an active-element hint (that would
 * reformat the whole script as Character/Dialogue). Also heals peeled 1-char tails.
 */
export function hardWrapDocument(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      out.push("");
      i += 1;
      continue;
    }

    const element = detectLineElement(line, {
      prev: i > 0 ? lines[i - 1] : undefined,
      next: i < lines.length - 1 ? lines[i + 1] : undefined,
    });
    const maxWidth = maxContentWidthForElement(element);

    // Absorb following short remainder lines (the 1-letter peel bug)
    let end = i;
    if (line.trim().length >= maxWidth) {
      while (end + 1 < lines.length) {
        const nextLine = lines[end + 1] ?? "";
        if (!nextLine.trim()) break;
        const nextEl = detectLineElement(nextLine, {
          prev: lines[end],
          next: end + 2 < lines.length ? lines[end + 2] : undefined,
        });
        if (nextEl !== element) break;
        if (nextLine.trim().length >= maxWidth) break;
        end += 1;
      }
    }

    const joined =
      end > i
        ? joinWrapFragments(
            lines.slice(i, end + 1).map((l) => l.trim()),
            maxWidth,
          )
        : line;
    out.push(...hardWrapLineForElement(element, joined));
    i = end + 1;
  }
  return out.join("\n");
}
