"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LINES_PER_PAGE,
  PAGE_GAP_PX,
  TAB_CYCLE,
  cycleElement,
  detectLineElement,
  formatLineWhileTyping,
  handleScreenplayEnter,
  hardWrapDocument,
  lineIndexAt,
  maxContentWidthForElement,
  pageCountForContent,
  resolveLineElement,
  formatLineForElement,
} from "@/lib/script-studio/screenplay-keyboard";
import {
  getScreenplaySuggestions,
  isSceneHeadingPrefixQuery,
  shouldAcceptSuggestionOnCommit,
  type ScreenplaySuggestion,
} from "@/lib/script-studio/screenplay-autocomplete";
import type { ScreenplayElementType } from "@/lib/script-studio/types";
import { ScreenplayTitlePage } from "@/components/script-studio/screenplay-title-page";
import { stripScreenplayPageFooters } from "@/lib/script-studio/screenplay-layout-repair";
import { SCREENPLAY_ELEMENT_LABELS, TRANSITIONS } from "@/lib/script-studio/elements";

/** US Letter page geometry (screenplay standard). */
const PAGE_WIDTH = "8.5in";
const PAGE_HEIGHT = "11in";
const MARGIN_TOP = "1in";
/** Extra bottom room so the page number never collides with the last script line. */
const MARGIN_BOTTOM = "1in";
const MARGIN_LEFT = "1.5in";
const MARGIN_RIGHT = "1in";
/** Approximate CSS px for 8.5in — used only for fit-to-viewport scaling. */
const PAGE_WIDTH_PX = 8.5 * 96;

/** Dismiss unused autocomplete after this idle period. */
const SUGGESTION_IDLE_MS = 2000;

type ScreenplayEditorProps = {
  value: string;
  onChange: (value: string) => void;
  activeElement?: ScreenplayElementType;
  onElementChange?: (element: ScreenplayElementType) => void;
  onBeforeChange?: () => void;
  readOnly?: boolean;
  fontCss: string;
  fontSizePt: number;
  lineHeight?: number;
  className?: string;
  placeholder?: string;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  onSelect?: () => void;
  theme?: "dark" | "light";
  /** Visual page scale (80–140). Pages stay US Letter width; zoom shrinks/grows the stack. */
  zoomPercent?: number;
  /** Skip mount-time hard wrap (use after import). */
  preserveStructure?: boolean;
  onPreserveStructureEnd?: () => void;
  /** Title page (always first sheet). */
  scriptTitle?: string;
  scriptType?: string;
  authorName?: string;
  onScriptTitleChange?: (title: string) => void;
  onScriptTypeChange?: (type: string) => void;
  /** Script-only writer credit — must not update the account profile. */
  onAuthorNameChange?: (authorName: string) => void;
  /** Bridge for undo/redo to use global caret positions across page textareas. */
  caretBridgeRef?: React.MutableRefObject<ScreenplayCaretBridge | null>;
};

export type ScreenplayCaretBridge = {
  getGlobalCaret: () => { start: number; end: number };
  setGlobalCaret: (start: number, end: number, content?: string) => void;
};

function splitContentIntoPages(content: string): string[] {
  const lines = content.split("\n");
  const pageCount = pageCountForContent(content);
  const pages: string[] = [];
  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    const start = pageIdx * LINES_PER_PAGE;
    pages.push(lines.slice(start, start + LINES_PER_PAGE).join("\n"));
  }
  return pages;
}

function pageStartOffset(content: string, pageIdx: number): number {
  const lines = content.split("\n");
  let offset = 0;
  const lineStart = pageIdx * LINES_PER_PAGE;
  for (let i = 0; i < lineStart && i < lines.length; i++) {
    offset += lines[i]!.length + 1;
  }
  return offset;
}

function pageIndexAtOffset(content: string, offset: number): number {
  return Math.floor(lineIndexAt(content, offset) / LINES_PER_PAGE);
}

/** Viewport position just under the caret — used for Tab cycle popups. */
function measureTextareaCaretAnchor(el: HTMLTextAreaElement): { top: number; left: number } {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  const props = [
    "direction",
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
  ] as const;
  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left - el.scrollLeft}px`;
  mirror.style.top = `${rect.top - el.scrollTop}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre";
  for (const prop of props) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }
  mirror.textContent = el.value.slice(0, el.selectionStart);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || 16;
  document.body.removeChild(mirror);

  const pad = 8;
  const popupGuessW = 280;
  const popupGuessH = 140;
  let top = markerRect.bottom + 6;
  let left = markerRect.left;
  if (top + popupGuessH > window.innerHeight - pad) {
    top = Math.max(pad, markerRect.top - popupGuessH - 6);
  }
  if (left + popupGuessW > window.innerWidth - pad) {
    left = Math.max(pad, window.innerWidth - popupGuessW - pad);
  }
  if (left < pad) left = pad;
  if (!Number.isFinite(top) || top < 0) {
    top = rect.top + lineHeight + 8;
    left = rect.left + 24;
  }
  return { top, left };
}

type CyclePickerState = {
  mode: "structure" | "transition";
  index: number;
  pageIdx: number;
  anchor: { top: number; left: number };
};

function mergePageIntoContent(content: string, pageIdx: number, pageText: string): string {
  const allLines = content.split("\n");
  const start = pageIdx * LINES_PER_PAGE;
  const before = allLines.slice(0, start);
  const after = allLines.slice(start + LINES_PER_PAGE);
  return [...before, ...pageText.split("\n"), ...after].join("\n");
}

export function ScreenplayEditor({
  value,
  onChange,
  activeElement: activeElementProp = "action",
  onElementChange,
  onBeforeChange,
  readOnly,
  fontCss,
  fontSizePt,
  className,
  placeholder,
  textareaRef: externalRef,
  onSelect,
  theme = "light",
  zoomPercent = 100,
  preserveStructure = false,
  onPreserveStructureEnd,
  scriptTitle = "Untitled Screenplay",
  scriptType = "FEATURE",
  authorName,
  onScriptTitleChange,
  onScriptTypeChange,
  onAuthorNameChange,
  caretBridgeRef,
}: ScreenplayEditorProps) {
  const resolvedAuthor = authorName?.trim() || "Creator";
  const pageRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [editingElement, setEditingElement] = useState<ScreenplayElementType>(activeElementProp);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<ScreenplaySuggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestionIdleTimerRef = useRef<number | null>(null);
  const suppressSuggestionBlurRef = useRef(false);
  /** True after ArrowUp/Down in the suggestion list — allows Enter to accept even on short queries. */
  const suggestionNavigatedRef = useRef(false);
  /** Apply caret after React commits the controlled value — never in rAF before paint. */
  const pendingCaretRef = useRef<{ start: number; end: number; content: string } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const activePageIdxRef = useRef(0);
  activePageIdxRef.current = activePageIdx;

  /** Hold Tab → structure cycle near caret; Tab+Enter → transitions; release to apply. */
  const tabHeldRef = useRef(false);
  const tabUsedForTransitionsRef = useRef(false);
  /** Only apply on Tab release after an intentional cycle / Enter / chip click. */
  const cycleCommittedRef = useRef(false);
  const [cyclePicker, setCyclePicker] = useState<CyclePickerState | null>(null);
  const cyclePickerRef = useRef(cyclePicker);
  cyclePickerRef.current = cyclePicker;

  useEffect(() => {
    setEditingElement(activeElementProp);
  }, [activeElementProp]);

  // One-time heal: strip leftover PDF footers and re-wrap peeled lines.
  const didHealRef = useRef(false);
  useEffect(() => {
    if (preserveStructure || didHealRef.current) return;
    didHealRef.current = true;
    const cleaned = stripScreenplayPageFooters(value);
    const healed = hardWrapDocument(cleaned);
    if (healed !== value) onChange(healed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only heal
  }, [preserveStructure]);

  // Fit US Letter pages to the visible desk width — never allow horizontal slide.
  const pagesStackRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    const resolveViewport = () =>
      (pagesStackRef.current?.closest(".script-writer-page-viewport") as HTMLElement | null) ??
      (document.querySelector(".script-writer-page-viewport") as HTMLElement | null);

    const measure = () => {
      const viewport = resolveViewport();
      if (!viewport) return;
      const pad = 32;
      const available = Math.max(120, viewport.clientWidth - pad);
      setFitScale(Math.min(1, available / PAGE_WIDTH_PX));
    };

    measure();
    const viewport = resolveViewport();
    if (!viewport) return;
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, []);

  const clearSuggestionIdle = useCallback(() => {
    if (suggestionIdleTimerRef.current != null) {
      window.clearTimeout(suggestionIdleTimerRef.current);
      suggestionIdleTimerRef.current = null;
    }
  }, []);

  const dismissSuggestions = useCallback(() => {
    clearSuggestionIdle();
    suggestionNavigatedRef.current = false;
    setSuggestions([]);
    setSuggestionIndex(0);
  }, [clearSuggestionIdle]);

  const bumpSuggestionIdle = useCallback(() => {
    clearSuggestionIdle();
    suggestionIdleTimerRef.current = window.setTimeout(() => {
      suggestionIdleTimerRef.current = null;
      setSuggestions([]);
      setSuggestionIndex(0);
    }, SUGGESTION_IDLE_MS);
  }, [clearSuggestionIdle]);

  useEffect(() => () => clearSuggestionIdle(), [clearSuggestionIdle]);

  const pageCount = pageCountForContent(value);
  const pageTexts = useMemo(() => splitContentIntoPages(value), [value]);

  const syncExternalRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (externalRef) externalRef.current = el;
    },
    [externalRef],
  );

  useEffect(() => {
    syncExternalRef(pageRefs.current[activePageIdx] ?? null);
  }, [activePageIdx, pageCount, syncExternalRef]);

  const applyPendingCaret = useCallback(() => {
    const pending = pendingCaretRef.current;
    if (!pending) return;
    if (pending.content !== valueRef.current) return;
    pendingCaretRef.current = null;
    const pageIdx = pageIndexAtOffset(pending.content, pending.start);
    const pageBase = pageStartOffset(pending.content, pageIdx);
    const el = pageRefs.current[pageIdx];
    if (!el) return;
    setActivePageIdx(pageIdx);
    const max = el.value.length;
    const localStart = Math.min(Math.max(0, pending.start - pageBase), max);
    const localEnd = Math.min(Math.max(0, pending.end - pageBase), max);
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    el.setSelectionRange(localStart, localEnd);
    syncExternalRef(el);
  }, [syncExternalRef]);

  useLayoutEffect(() => {
    applyPendingCaret();
  }, [value, applyPendingCaret]);

  const queueCaret = useCallback((content: string, start: number, end = start) => {
    pendingCaretRef.current = { content, start, end };
  }, []);

  const focusAt = useCallback(
    (globalOffset: number, selectionEnd = globalOffset, content = valueRef.current) => {
      queueCaret(content, globalOffset, selectionEnd);
      if (content === valueRef.current) {
        requestAnimationFrame(() => applyPendingCaret());
      }
    },
    [queueCaret, applyPendingCaret],
  );

  // Expose global caret get/set for undo/redo in the parent studio.
  useEffect(() => {
    if (!caretBridgeRef) return;
    caretBridgeRef.current = {
      getGlobalCaret: () => {
        const pageIdx = activePageIdxRef.current;
        const el = pageRefs.current[pageIdx];
        const content = valueRef.current;
        if (!el) {
          return { start: 0, end: 0 };
        }
        const base = pageStartOffset(content, pageIdx);
        return {
          start: base + el.selectionStart,
          end: base + el.selectionEnd,
        };
      },
      setGlobalCaret: (start, end, content) => {
        focusAt(start, end, content ?? valueRef.current);
      },
    };
    return () => {
      caretBridgeRef.current = null;
    };
  }, [caretBridgeRef, focusAt]);

  // Clamp active page when undo/import shrinks page count.
  useEffect(() => {
    if (activePageIdx >= pageCount) {
      setActivePageIdx(Math.max(0, pageCount - 1));
    }
  }, [pageCount, activePageIdx]);

  const refreshSuggestions = useCallback(
    (content: string, globalCursor: number, element: ScreenplayElementType) => {
      const lineIdx = lineIndexAt(content, globalCursor);
      const lines = content.split("\n");
      const line = lines[lineIdx] ?? "";
      const neighbors = {
        prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
        next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
      };
      const detected = detectLineElement(line, neighbors);
      let suggestionElement = resolveLineElement(line, neighbors, element);
      const trimmed = line.trim();
      const prefixToken = trimmed.replace(/\s+.*$/, "");

      if (
        element === "scene_heading" &&
        detected === "action" &&
        trimmed &&
        !/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i.test(trimmed) &&
        !isSceneHeadingPrefixQuery(prefixToken)
      ) {
        suggestionElement = "action";
      }

      const next = getScreenplaySuggestions({
        content,
        line,
        element: suggestionElement,
        prevLine: neighbors.prev,
      });
      suggestionNavigatedRef.current = false;
      setSuggestions(next);
      setSuggestionIndex(0);
      if (next.length > 0) bumpSuggestionIdle();
      else clearSuggestionIdle();
    },
    [bumpSuggestionIdle, clearSuggestionIdle],
  );

  const syncElementFromCursor = useCallback(
    (pageIdx: number, selectionStart: number) => {
      const globalStart = pageStartOffset(value, pageIdx) + selectionStart;
      const lineIdx = lineIndexAt(value, globalStart);
      const lines = value.split("\n");
      const element = resolveLineElement(
        lines[lineIdx] ?? "",
        {
          prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
          next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
        },
        editingElement,
      );
      setEditingElement(element);
      onElementChange?.(element);
      refreshSuggestions(value, globalStart, element);
    },
    [value, editingElement, onElementChange, refreshSuggestions],
  );

  const applyEdit = useCallback(
    (result: {
      content: string;
      selectionStart: number;
      selectionEnd: number;
      element?: ScreenplayElementType;
    }) => {
      queueCaret(result.content, result.selectionStart, result.selectionEnd);
      onChange(result.content);
      if (result.element) {
        setEditingElement(result.element);
        onElementChange?.(result.element);
        refreshSuggestions(result.content, result.selectionStart, result.element);
      } else {
        dismissSuggestions();
      }
    },
    [onChange, onElementChange, queueCaret, refreshSuggestions, dismissSuggestions],
  );

  const applySuggestion = useCallback(
    (suggestion: ScreenplaySuggestion, pageIdx: number) => {
      onBeforeChange?.();
      const el = pageRefs.current[pageIdx];
      const content = valueRef.current;
      const localCursor = el?.selectionStart ?? 0;
      const globalCursor = pageStartOffset(content, pageIdx) + localCursor;
      const lineIdx = lineIndexAt(content, globalCursor);
      const lines = content.split("\n");
      lines[lineIdx] = suggestion.insert;
      const newContent = lines.join("\n");
      let lineStart = 0;
      for (let i = 0; i < lineIdx; i++) lineStart += (lines[i]?.length ?? 0) + 1;
      dismissSuggestions();
      applyEdit({
        content: newContent,
        selectionStart: lineStart + suggestion.insert.length,
        selectionEnd: lineStart + suggestion.insert.length,
        element: suggestion.element ?? editingElement,
      });
    },
    [editingElement, onBeforeChange, applyEdit, dismissSuggestions],
  );

  const commitPageText = useCallback(
    (pageIdx: number, pageText: string, localCursor: number) => {
      const previous = valueRef.current;
      const provisional = mergePageIntoContent(previous, pageIdx, pageText);
      const globalCursor = pageStartOffset(previous, pageIdx) + localCursor;
      if (preserveStructure) {
        onChange(provisional);
        refreshSuggestions(provisional, globalCursor, editingElement);
        return;
      }

      // While deleting, skip live reformatting unless the line is still over width —
      // constant format-on-backspace was stacking/overlapping text under the caret.
      const shrinking = provisional.length < previous.length;
      if (shrinking) {
        const lineIdx = lineIndexAt(provisional, globalCursor);
        const lines = provisional.split("\n");
        const current = lines[lineIdx] ?? "";
        const neighbors = {
          prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
          next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
        };
        const element = resolveLineElement(current, neighbors, editingElement);
        const overMax =
          current.trim().length > maxContentWidthForElement(element);
        if (!overMax) {
          onChange(provisional);
          refreshSuggestions(provisional, globalCursor, element);
          return;
        }
      }

      const formatted = formatLineWhileTyping(provisional, globalCursor, editingElement);

      if (formatted) {
        queueCaret(formatted.content, formatted.selectionStart, formatted.selectionEnd);
        onChange(formatted.content);
        if (formatted.element) {
          setEditingElement(formatted.element);
          onElementChange?.(formatted.element);
        }
        refreshSuggestions(
          formatted.content,
          formatted.selectionStart,
          formatted.element ?? editingElement,
        );
        return;
      }

      // Native caret is correct for plain inserts/deletes — do not fight it with focusAt.
      onChange(provisional);
      refreshSuggestions(provisional, globalCursor, editingElement);
    },
    [editingElement, onChange, onElementChange, queueCaret, refreshSuggestions, preserveStructure],
  );

  const insertTransitionAt = useCallback(
    (pageIdx: number, transition: string) => {
      const content = valueRef.current;
      const el = pageRefs.current[pageIdx];
      const local = el?.selectionStart ?? 0;
      const globalCursor = pageStartOffset(content, pageIdx) + local;
      const lineIdx = lineIndexAt(content, globalCursor);
      const lines = content.split("\n");
      lines[lineIdx] = formatLineForElement("transition", transition);
      const newLines = [...lines.slice(0, lineIdx + 1), "", ...lines.slice(lineIdx + 1)];
      const newContent = newLines.join("\n");
      let caret = 0;
      for (let i = 0; i < lineIdx + 1; i++) caret += (newLines[i]?.length ?? 0) + 1;
      onBeforeChange?.();
      applyEdit({
        content: newContent,
        selectionStart: caret,
        selectionEnd: caret,
        element: "action",
      });
    },
    [applyEdit, onBeforeChange],
  );

  const applyStructureAt = useCallback(
    (pageIdx: number, element: ScreenplayElementType) => {
      const content = valueRef.current;
      const el = pageRefs.current[pageIdx];
      const local = el?.selectionStart ?? 0;
      const globalCursor = pageStartOffset(content, pageIdx) + local;
      const lineIdx = lineIndexAt(content, globalCursor);
      const lines = content.split("\n");
      const current = lines[lineIdx] ?? "";
      const placeholder =
        element === "scene_heading"
          ? "INT. LOCATION - DAY"
          : element === "character"
            ? "CHARACTER"
            : element === "parenthetical"
              ? "beat"
              : element === "dialogue"
                ? "Dialogue."
                : element === "transition"
                  ? "CUT TO:"
                  : element === "shot"
                    ? "CLOSE UP"
                    : element === "centered"
                      ? "THE END"
                      : "";
      const formatted = formatLineForElement(element, current.trim() || placeholder);
      let start = 0;
      for (let i = 0; i < lineIdx; i++) start += (lines[i]?.length ?? 0) + 1;
      const newContent = content.slice(0, start) + formatted + content.slice(start + current.length);
      const caret = start + formatted.length;
      onBeforeChange?.();
      if (preserveStructure) onPreserveStructureEnd?.();
      applyEdit({
        content: newContent,
        selectionStart: caret,
        selectionEnd: caret,
        element,
      });
    },
    [applyEdit, onBeforeChange, preserveStructure, onPreserveStructureEnd],
  );

  const measureAnchorForPage = useCallback((pageIdx: number) => {
    const el = pageRefs.current[pageIdx];
    if (!el) return { top: 80, left: 80 };
    return measureTextareaCaretAnchor(el);
  }, []);

  const closeCyclePicker = useCallback(() => {
    setCyclePicker(null);
    tabUsedForTransitionsRef.current = false;
    cycleCommittedRef.current = false;
  }, []);

  const handlePageKeyDown = useCallback(
    (pageIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = e.currentTarget;
      const content = valueRef.current;
      const globalStart = pageStartOffset(content, pageIdx) + el.selectionStart;
      const globalEnd = pageStartOffset(content, pageIdx) + el.selectionEnd;

      // Only steal arrows for suggestions after the user has navigated the list —
      // otherwise ArrowUp/Down must move the caret between lines normally.
      if (suggestions.length > 0 && suggestionNavigatedRef.current) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSuggestionIndex((i) => (i + 1) % suggestions.length);
          bumpSuggestionIdle();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          bumpSuggestionIdle();
          return;
        }
      }
      if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        if (e.altKey) {
          e.preventDefault();
          suggestionNavigatedRef.current = true;
          setSuggestionIndex((i) =>
            e.key === "ArrowDown"
              ? (i + 1) % suggestions.length
              : (i - 1 + suggestions.length) % suggestions.length,
          );
          bumpSuggestionIdle();
          return;
        }
      }

      if (suggestions.length > 0 && e.key === "Escape") {
        e.preventDefault();
        dismissSuggestions();
        return;
      }

      if (suggestions.length > 0) {
        const lineIdx = lineIndexAt(content, globalStart);
        const currentLine = content.split("\n")[lineIdx] ?? "";
        const activeSuggestion = suggestions[suggestionIndex] ?? suggestions[0];
        const accept = shouldAcceptSuggestionOnCommit({
          line: currentLine,
          element: editingElement,
          suggestionCount: suggestions.length,
          navigated: suggestionNavigatedRef.current,
          activeInsert: activeSuggestion?.insert,
        });

        if (accept && e.key === "Enter" && !e.shiftKey && !tabHeldRef.current && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          applySuggestion(activeSuggestion!, pageIdx);
          return;
        }
        if (e.key === "Backspace" || e.key === "Delete") {
          bumpSuggestionIdle();
        }
      }

      if (e.key === "Escape" && cyclePickerRef.current) {
        e.preventDefault();
        closeCyclePicker();
        tabHeldRef.current = false;
        return;
      }

      // Tab held → optional structure popup near caret (does NOT apply until you cycle/click).
      // Enter while held → transitions. Quick Tab tap with no cycle = cancel (keep typing).
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        dismissSuggestions();
        const anchor = measureAnchorForPage(pageIdx);
        if (!tabHeldRef.current) {
          tabHeldRef.current = true;
          tabUsedForTransitionsRef.current = false;
          cycleCommittedRef.current = false;
          const next = cycleElement(editingElement, e.shiftKey ? -1 : 1);
          const index = Math.max(0, TAB_CYCLE.indexOf(next));
          setCyclePicker({
            mode: "structure",
            index,
            pageIdx,
            anchor,
          });
          return;
        }
        // Tab still held (key repeat / second tap): intentional cycle
        cycleCommittedRef.current = true;
        setCyclePicker((prev) => {
          if (!prev) return prev;
          if (prev.mode === "transition") {
            return {
              ...prev,
              pageIdx,
              anchor,
              index: (prev.index + (e.shiftKey ? -1 : 1) + TRANSITIONS.length) % TRANSITIONS.length,
            };
          }
          return {
            ...prev,
            pageIdx,
            anchor,
            index: (prev.index + (e.shiftKey ? -1 : 1) + TAB_CYCLE.length) % TAB_CYCLE.length,
          };
        });
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && tabHeldRef.current) {
        e.preventDefault();
        tabUsedForTransitionsRef.current = true;
        cycleCommittedRef.current = true;
        dismissSuggestions();
        const anchor = measureAnchorForPage(pageIdx);
        setCyclePicker((prev) => {
          if (!prev || prev.mode !== "transition") {
            return { mode: "transition", index: 0, pageIdx, anchor };
          }
          return {
            ...prev,
            pageIdx,
            anchor,
            index: (prev.index + 1) % TRANSITIONS.length,
          };
        });
        return;
      }

      // Space while Tab held confirms the highlighted structure/transition (apply on Tab release).
      if (e.key === " " && tabHeldRef.current && cyclePickerRef.current) {
        e.preventDefault();
        cycleCommittedRef.current = true;
        return;
      }

      // Typing while a leftover cycle popup is open (Tab not held) — dismiss, don't rewrite.
      if (cyclePickerRef.current && !tabHeldRef.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        closeCyclePicker();
      }

      if (
        editingElement === "character" &&
        e.key.length === 1 &&
        /[a-z]/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        onBeforeChange?.();
        const next = content.slice(0, globalStart) + e.key.toUpperCase() + content.slice(globalEnd);
        applyEdit(
          formatLineWhileTyping(next, globalStart + 1, "character") ?? {
            content: next,
            selectionStart: globalStart + 1,
            selectionEnd: globalStart + 1,
            element: "character",
          },
        );
        return;
      }

      if (e.key === "(" && editingElement !== "character" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onBeforeChange?.();
        const next = content.slice(0, globalStart) + "(" + content.slice(globalEnd);
        applyEdit(
          formatLineWhileTyping(next, globalStart + 1, "parenthetical") ?? {
            content: next,
            selectionStart: globalStart + 1,
            selectionEnd: globalStart + 1,
            element: "parenthetical",
          },
        );
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onBeforeChange?.();
        if (preserveStructure) onPreserveStructureEnd?.();
        dismissSuggestions();
        applyEdit(handleScreenplayEnter(content, globalStart, editingElement));
        return;
      }

      // Soft page boundary: backspace at start of page N must delete the joining newline.
      if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && pageIdx > 0) {
        e.preventDefault();
        onBeforeChange?.();
        const joinAt = pageStartOffset(content, pageIdx);
        if (joinAt <= 0) {
          focusAt(0, 0, content);
          return;
        }
        const newContent = content.slice(0, joinAt - 1) + content.slice(joinAt);
        dismissSuggestions();
        applyEdit({
          content: newContent,
          selectionStart: joinAt - 1,
          selectionEnd: joinAt - 1,
          element: editingElement,
        });
        return;
      }

      // Page jumps only at absolute start/end — mid-page arrows stay native.
      if (
        e.key === "ArrowUp" &&
        el.selectionStart === 0 &&
        el.selectionEnd === 0 &&
        pageIdx > 0
      ) {
        e.preventDefault();
        const prevEl = pageRefs.current[pageIdx - 1];
        if (!prevEl) return;
        focusAt(pageStartOffset(content, pageIdx - 1) + prevEl.value.length, undefined, content);
      }

      if (
        e.key === "ArrowDown" &&
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length &&
        pageIdx < pageCount - 1
      ) {
        e.preventDefault();
        focusAt(pageStartOffset(content, pageIdx + 1), undefined, content);
      }
    },
    [
      readOnly,
      pageCount,
      editingElement,
      suggestions,
      suggestionIndex,
      onBeforeChange,
      applyEdit,
      applySuggestion,
      focusAt,
      bumpSuggestionIdle,
      dismissSuggestions,
      preserveStructure,
      onPreserveStructureEnd,
      measureAnchorForPage,
      closeCyclePicker,
    ],
  );

  // Tab release: apply only after an intentional cycle (Tab repeat / Enter / Space) or leave text alone.
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const wasHeld = tabHeldRef.current;
      tabHeldRef.current = false;
      if (!wasHeld || readOnly) return;

      const picker = cyclePickerRef.current;
      const committed = cycleCommittedRef.current;

      // Accidental / quick Tab: dismiss popup and keep writing (periods, ellipses, etc.).
      if (!committed || !picker) {
        closeCyclePicker();
        return;
      }

      if (picker.mode === "transition") {
        const transition = TRANSITIONS[picker.index] ?? TRANSITIONS[0]!;
        closeCyclePicker();
        insertTransitionAt(picker.pageIdx, transition);
        return;
      }

      if (picker.mode === "structure") {
        const element = TAB_CYCLE[picker.index] ?? "action";
        closeCyclePicker();
        applyStructureAt(picker.pageIdx, element);
        return;
      }

      closeCyclePicker();
    };
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [readOnly, insertTransitionAt, applyStructureAt, closeCyclePicker]);

  const handlePageChange = useCallback(
    (pageIdx: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      commitPageText(pageIdx, e.target.value, e.target.selectionStart);
    },
    [readOnly, commitPageText],
  );

  const transitionSuggestions = useMemo(
    () => suggestions.filter((s) => s.element === "transition"),
    [suggestions],
  );
  const generalSuggestions = useMemo(
    () => suggestions.filter((s) => s.element !== "transition"),
    [suggestions],
  );

  const pageSurface = "script-writer-page script-writer-page--light";
  const zoomScale =
    fitScale * (Math.min(150, Math.max(50, zoomPercent)) / 100);
  const lineHeightCss = `calc((11in - ${MARGIN_TOP} - ${MARGIN_BOTTOM}) / ${LINES_PER_PAGE})`;

  return (
    <div className="script-writer-editor-root w-full" data-studio-theme={theme}>
      {cyclePicker && typeof document !== "undefined"
        ? createPortal(
            <div
              className="script-writer-cycle-popup"
              role="listbox"
              aria-label={
                cyclePicker.mode === "transition"
                  ? "Transition cycle — release Tab to insert"
                  : "Structure cycle — release Tab to apply"
              }
              style={{ top: cyclePicker.anchor.top, left: cyclePicker.anchor.left }}
            >
              <p className="script-writer-suggestion-label">
                {cyclePicker.mode === "transition"
                  ? "Transitions · Enter cycles · Space confirms · release Tab / click to insert"
                  : "Structure · Tab cycles · Space confirms · Enter for transitions · Esc cancels"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cyclePicker.mode === "transition"
                  ? TRANSITIONS.map((t, i) => (
                      <button
                        key={t}
                        type="button"
                        role="option"
                        aria-selected={i === cyclePicker.index}
                        className={`script-writer-suggestion-chip ${
                          i === cyclePicker.index ? "is-active" : ""
                        }`}
                        style={{ fontFamily: fontCss }}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          const pageIdx = cyclePicker.pageIdx;
                          closeCyclePicker();
                          tabHeldRef.current = false;
                          insertTransitionAt(pageIdx, t);
                        }}
                      >
                        {t}
                      </button>
                    ))
                  : TAB_CYCLE.map((elType, i) => (
                      <button
                        key={elType}
                        type="button"
                        role="option"
                        aria-selected={i === cyclePicker.index}
                        className={`script-writer-suggestion-chip ${
                          i === cyclePicker.index ? "is-active" : ""
                        }`}
                        style={{ fontFamily: fontCss }}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          const pageIdx = cyclePicker.pageIdx;
                          closeCyclePicker();
                          tabHeldRef.current = false;
                          applyStructureAt(pageIdx, elType);
                        }}
                      >
                        {SCREENPLAY_ELEMENT_LABELS[elType]}
                      </button>
                    ))}
              </div>
            </div>,
            document.body,
          )
        : null}

      {suggestions.length > 0 && !cyclePicker ? (
        <div
          className="script-writer-suggestion-dock"
          role="listbox"
          aria-label="Screenplay suggestions"
          onMouseEnter={bumpSuggestionIdle}
          onMouseMove={bumpSuggestionIdle}
        >
          {transitionSuggestions.length > 0 ? (
            <div className="script-writer-suggestion-group">
              <p className="script-writer-suggestion-label">Transitions</p>
              <div className="flex flex-wrap gap-1.5">
                {transitionSuggestions.map((s, i) => {
                  const globalIdx = suggestions.indexOf(s);
                  return (
                    <button
                      key={`${s.label}-t-${i}`}
                      type="button"
                      role="option"
                      aria-selected={globalIdx === suggestionIndex}
                      className={`script-writer-suggestion-chip ${
                        globalIdx === suggestionIndex ? "is-active" : ""
                      }`}
                      style={{ fontFamily: fontCss }}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        suppressSuggestionBlurRef.current = true;
                        applySuggestion(s, activePageIdx);
                        window.setTimeout(() => {
                          suppressSuggestionBlurRef.current = false;
                        }, 0);
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {generalSuggestions.length > 0 ? (
            <div className="script-writer-suggestion-list">
              {generalSuggestions.map((s, i) => {
                const globalIdx = suggestions.indexOf(s);
                return (
                  <button
                    key={`${s.label}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={globalIdx === suggestionIndex}
                    className={`script-writer-suggestion-item ${
                      globalIdx === suggestionIndex ? "is-active" : ""
                    }`}
                    style={{ fontFamily: fontCss }}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      suppressSuggestionBlurRef.current = true;
                      applySuggestion(s, activePageIdx);
                      window.setTimeout(() => {
                        suppressSuggestionBlurRef.current = false;
                      }, 0);
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="script-writer-editor-scroll" data-screenplay-scroll>
        <div
          ref={pagesStackRef}
          className="script-writer-pages-stack"
          style={{ zoom: zoomScale }}
        >
          <ScreenplayTitlePage
            title={scriptTitle}
            authorName={resolvedAuthor}
            scriptType={scriptType}
            fontCss={fontCss}
            pageWidth={PAGE_WIDTH}
            pageHeight={PAGE_HEIGHT}
            pageSurfaceClassName={`${pageSurface} text-[#0f172a]`}
            marginBottom={PAGE_GAP_PX}
            readOnly={readOnly}
            onTitleChange={onScriptTitleChange}
            onAuthorNameChange={onAuthorNameChange}
            onScriptTypeChange={onScriptTypeChange}
          />

          {pageTexts.map((pageText, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className={`relative overflow-hidden ${pageSurface}`}
              style={{
                width: PAGE_WIDTH,
                maxWidth: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                marginBottom: pageIdx < pageCount - 1 ? PAGE_GAP_PX : 0,
                boxSizing: "border-box",
              }}
            >
              <span
                className="pointer-events-none absolute bottom-4 right-5 z-[2] text-[10px] text-slate-500"
                style={{ fontFamily: fontCss }}
                aria-hidden
              >
                {pageIdx + 1}.
              </span>

              <textarea
                ref={(el) => {
                  pageRefs.current[pageIdx] = el;
                  if (pageIdx === activePageIdx) syncExternalRef(el);
                }}
                value={pageText}
                onChange={(e) => handlePageChange(pageIdx, e)}
                onKeyDown={(e) => handlePageKeyDown(pageIdx, e)}
                onSelect={(e) => {
                  setActivePageIdx(pageIdx);
                  syncExternalRef(e.currentTarget);
                  syncElementFromCursor(pageIdx, e.currentTarget.selectionStart);
                  onSelect?.();
                }}
                onClick={(e) => {
                  setActivePageIdx(pageIdx);
                  syncExternalRef(e.currentTarget);
                  syncElementFromCursor(pageIdx, e.currentTarget.selectionStart);
                }}
                onFocus={() => {
                  setActivePageIdx(pageIdx);
                  syncExternalRef(pageRefs.current[pageIdx] ?? null);
                }}
                onBlur={() => {
                  if (suppressSuggestionBlurRef.current) return;
                  window.setTimeout(() => {
                    if (suppressSuggestionBlurRef.current) return;
                    dismissSuggestions();
                    // Don't rewrite action/dialogue on blur — that fights the Format
                    // dropdown and normal typing when focus moves to the toolbar.
                    if (
                      readOnly ||
                      preserveStructure ||
                      editingElement === "action" ||
                      editingElement === "dialogue"
                    ) {
                      return;
                    }
                    const el = pageRefs.current[pageIdx];
                    if (el) {
                      const globalCursor = pageStartOffset(valueRef.current, pageIdx) + el.selectionStart;
                      const formatted = formatLineWhileTyping(
                        valueRef.current,
                        globalCursor,
                        editingElement,
                      );
                      if (formatted) {
                        applyEdit(formatted);
                      }
                    }
                  }, 180);
                }}
                readOnly={readOnly}
                spellCheck
                rows={LINES_PER_PAGE}
                wrap="off"
                className={`relative z-[1] block resize-none border-0 bg-transparent outline-none focus:ring-0 ${className ?? ""}`}
                style={{
                  fontFamily: fontCss,
                  fontSize: `${Math.min(fontSizePt, 12)}pt`,
                  lineHeight: lineHeightCss,
                  caretColor: "#0f172a",
                  color: "#0f172a",
                  width: "100%",
                  height: "100%",
                  boxSizing: "border-box",
                  paddingTop: MARGIN_TOP,
                  paddingBottom: MARGIN_BOTTOM,
                  paddingLeft: MARGIN_LEFT,
                  paddingRight: MARGIN_RIGHT,
                  // Hard-wrapped imports/edits: one \n = one page row. Soft wrap was
                  // overflowing the fixed page box past the bottom margin.
                  whiteSpace: "pre",
                  overflowWrap: "normal",
                  overflowX: "hidden",
                  overflowY: "hidden",
                  letterSpacing: "normal",
                  wordSpacing: "normal",
                }}
                placeholder={pageIdx === 0 ? placeholder : undefined}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ))}

        </div>
      </div>

      <div className="script-writer-editor-meta">
        <p style={{ fontFamily: fontCss }}>
          Title + {pageCount} page{pageCount === 1 ? "" : "s"} · US Letter
        </p>
      </div>
    </div>
  );
}
