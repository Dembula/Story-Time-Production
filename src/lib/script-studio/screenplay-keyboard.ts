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
      return trimmed;
  }
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

/** Live-format the current line while typing (caps, columns, smart switches). */
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

  const shouldFormat =
    UPPERCASE_ELEMENTS.has(element) ||
    element === "dialogue" ||
    element === "parenthetical" ||
    element === "centered" ||
    element === "lyrics";

  if (!shouldFormat && element === activeElement) return null;

  const formatted = formatLineForElement(element, current);
  if (formatted === current && element === activeElement) return null;

  const lineStart = lineStartAt(content, lineIdx);
  const lineEnd = lineStart + current.length;
  const cursorInLine = cursorPos - lineStart;
  const newContent = content.slice(0, lineStart) + formatted + content.slice(lineEnd);
  const delta = formatted.length - current.length;

  // Keep caret inside parenthetical content when possible
  let newCursor = Math.max(lineStart, Math.min(lineStart + cursorInLine + delta, lineStart + formatted.length));
  if (element === "parenthetical" && formatted.includes("(")) {
    const open = formatted.indexOf("(");
    const close = formatted.lastIndexOf(")");
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
