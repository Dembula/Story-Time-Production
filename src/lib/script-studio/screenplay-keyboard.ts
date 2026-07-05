import type { ScreenplayElementType } from "./types";
import {
  SCREENPLAY_COL,
  SCREENPLAY_LINE_WIDTH,
  getElementSnippet,
} from "./elements";

export const LINES_PER_PAGE = 55;

/** Tab / Shift+Tab cycle order for core screenplay elements. */
export const TAB_CYCLE: ScreenplayElementType[] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|EST\.)/i;
const TRANSITION_START = /^(FADE|CUT|DISSOLVE|SMASH|MATCH|WIPE|IRIS)/i;
const TRANSITION_END = /(TO:|:)$/;
const CHARACTER_LINE = /^[A-Z][A-Z0-9 .'\-()]{1,42}$/;

function padColumn(text: string, column: number): string {
  return " ".repeat(Math.max(0, column)) + text.trimEnd();
}

function rightAlign(text: string, width = SCREENPLAY_LINE_WIDTH): string {
  const trimmed = text.trim();
  const pad = Math.max(0, width - trimmed.length);
  return " ".repeat(pad) + trimmed;
}

function leadingSpaces(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (trimmed.startsWith("(") && trimmed.endsWith(")")) return "parenthetical";

  const nextTrim = neighbors?.next?.trim() ?? "";
  const nameOnly = trimmed.replace(/\s*\((V\.O\.|O\.S\.|CONT'D)\)\s*$/i, "").trim();

  if (
    CHARACTER_LINE.test(nameOnly) &&
    !SCENE_HEADING.test(nameOnly) &&
    !TRANSITION_START.test(nameOnly)
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

  return "action";
}

export function formatLineForElement(element: ScreenplayElementType, rawLine: string): string {
  const trimmed = rawLine.trim();
  if (!trimmed) return "";

  switch (element) {
    case "scene_heading":
      return trimmed.toUpperCase();
    case "character": {
      const upper = trimmed.toUpperCase();
      return padColumn(upper, SCREENPLAY_COL.character);
    }
    case "parenthetical": {
      const inner = trimmed.replace(/^\(|\)$/g, "").trim();
      return padColumn(`(${inner})`, SCREENPLAY_COL.parenthetical);
    }
    case "dialogue":
      return padColumn(trimmed, SCREENPLAY_COL.dialogue);
    case "transition":
      return rightAlign(trimmed.toUpperCase());
    case "action":
    default:
      return trimmed;
  }
}

export function nextElementOnEnter(current: ScreenplayElementType): ScreenplayElementType {
  switch (current) {
    case "scene_heading":
      return "action";
    case "character":
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return "action";
    case "transition":
      return "scene_heading";
    case "action":
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
    .replace(/\s*\((V\.O\.|O\.S\.|CONT'D)\)\s*$/i, "")
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

function lineIndexAt(content: string, pos: number): number {
  return content.slice(0, pos).split("\n").length - 1;
}

function lineStartAt(content: string, lineIndex: number): number {
  const lines = content.split("\n");
  let start = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    start += (lines[i]?.length ?? 0) + 1;
  }
  return start;
}

/** Format current line and insert the next element line on Enter. */
export function handleScreenplayEnter(content: string, cursorPos: number): ScreenplayKeyResult {
  const lineIdx = lineIndexAt(content, cursorPos);
  let lines = content.split("\n");
  const prev = lineIdx > 0 ? lines[lineIdx - 1] : undefined;
  const current = lines[lineIdx] ?? "";
  const next = lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined;

  const currentElement = detectLineElement(current, { prev, next });
  let working = content;
  if (currentElement === "character") {
    working = capitalizeCharacterFirstMention(working, current);
    lines = working.split("\n");
  }

  const formatted = formatLineForElement(currentElement, lines[lineIdx] ?? current);
  lines[lineIdx] = formatted;

  const nextElement = nextElementOnEnter(currentElement);
  const insertLines: string[] = [];

  if (nextElement === "dialogue") {
    const dialogueLine = getElementSnippet("dialogue").text.trim().split("\n")[0] ?? "";
    insertLines.push(dialogueLine);
  } else if (nextElement === "scene_heading") {
    insertLines.push("", "INT. LOCATION - DAY");
  } else if (currentElement === "scene_heading" || currentElement === "dialogue" || currentElement === "transition") {
    insertLines.push("", "");
  } else {
    insertLines.push("");
  }

  const newLines = [...lines.slice(0, lineIdx + 1), ...insertLines, ...lines.slice(lineIdx + 1)];
  const newContent = newLines.join("\n");

  const insertStart = lineStartAt(newContent, lineIdx + 1);
  const snippet = nextElement === "dialogue" ? getElementSnippet("dialogue") : null;
  let selectionStart = insertStart + (insertLines.join("\n").length);
  let selectionEnd = selectionStart;

  if (snippet?.select && nextElement === "dialogue") {
    selectionStart = insertStart + snippet.select.start;
    selectionEnd = insertStart + snippet.select.end;
  } else if (nextElement === "scene_heading") {
    const slugStart = lineStartAt(newContent, lineIdx + 2);
    selectionStart = slugStart + 5;
    selectionEnd = slugStart + 13;
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
): ScreenplayKeyResult {
  const lineIdx = lineIndexAt(content, cursorPos);
  const lines = content.split("\n");
  const current = lines[lineIdx] ?? "";
  const element = detectLineElement(current, {
    prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
    next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
  });
  const nextElement = cycleElement(element, direction);
  const placeholder = SCREENPLAY_ELEMENT_PLACEHOLDER[nextElement] ?? "";
  const formatted = formatLineForElement(nextElement, current || placeholder);

  const lineStart = lineStartAt(content, lineIdx);
  const lineEnd = lineStart + current.length;
  const newContent = content.slice(0, lineStart) + formatted + content.slice(lineEnd);
  const selStart = lineStart + formatted.length;

  return {
    content: newContent,
    selectionStart: selStart,
    selectionEnd: selStart,
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
};

export function paginateLineIndices(content: string): number[] {
  const lineCount = content.split("\n").length;
  const breaks: number[] = [];
  for (let i = LINES_PER_PAGE; i < lineCount; i += LINES_PER_PAGE) {
    breaks.push(i);
  }
  return breaks;
}
