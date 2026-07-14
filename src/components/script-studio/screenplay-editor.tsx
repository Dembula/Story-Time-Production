"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  LINES_PER_PAGE,
  PAGE_GAP_PX,
  formatLineWhileTyping,
  handleScreenplayEnter,
  handleScreenplayTab,
  hardWrapDocument,
  lineIndexAt,
  pageCountForContent,
  resolveLineElement,
} from "@/lib/script-studio/screenplay-keyboard";
import { SCREENPLAY_LINE_WIDTH } from "@/lib/script-studio/elements";
import {
  getScreenplaySuggestions,
  type ScreenplaySuggestion,
} from "@/lib/script-studio/screenplay-autocomplete";
import type { ScreenplayElementType } from "@/lib/script-studio/types";

/** US Letter page geometry (screenplay standard). */
const PAGE_WIDTH = "8.5in";
const PAGE_HEIGHT = "11in";
const MARGIN_TOP = "1in";
const MARGIN_BOTTOM = "1in";
const MARGIN_LEFT = "1.5in";
const MARGIN_RIGHT = "1in";

/** Dismiss unused autocomplete after this idle period. */
const SUGGESTION_IDLE_MS = 3000;

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
  theme = "dark",
}: ScreenplayEditorProps) {
  const pageRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const [editingElement, setEditingElement] = useState<ScreenplayElementType>(activeElementProp);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<ScreenplaySuggestion[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const suggestionIdleTimerRef = useRef<number | null>(null);
  const suppressSuggestionBlurRef = useRef(false);
  /** Apply caret after React commits the controlled value — never in rAF before paint. */
  const pendingCaretRef = useRef<{ start: number; end: number; content: string } | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setEditingElement(activeElementProp);
  }, [activeElementProp]);

  // One-time heal for scripts already damaged by peeled 1-char wrap lines.
  const didHealRef = useRef(false);
  useEffect(() => {
    if (didHealRef.current) return;
    didHealRef.current = true;
    const healed = hardWrapDocument(value);
    if (healed !== value) onChange(healed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only heal
  }, []);

  const clearSuggestionIdle = useCallback(() => {
    if (suggestionIdleTimerRef.current != null) {
      window.clearTimeout(suggestionIdleTimerRef.current);
      suggestionIdleTimerRef.current = null;
    }
  }, []);

  const dismissSuggestions = useCallback(() => {
    clearSuggestionIdle();
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
    if (document.activeElement !== el) el.focus();
    el.setSelectionRange(localStart, localEnd);
    syncExternalRef(el);
  }, [syncExternalRef]);

  useLayoutEffect(() => {
    applyPendingCaret();
  }, [value, applyPendingCaret]);

  const queueCaret = useCallback((content: string, start: number, end = start) => {
    pendingCaretRef.current = { content, start, end };
  }, []);

  const refreshSuggestions = useCallback(
    (content: string, globalCursor: number, element: ScreenplayElementType) => {
      const lineIdx = lineIndexAt(content, globalCursor);
      const line = content.split("\n")[lineIdx] ?? "";
      const next = getScreenplaySuggestions({ content, line, element });
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

  const focusAt = useCallback(
    (globalOffset: number, selectionEnd = globalOffset, content = valueRef.current) => {
      queueCaret(content, globalOffset, selectionEnd);
      // If value is already committed, apply immediately.
      if (content === valueRef.current) {
        requestAnimationFrame(() => applyPendingCaret());
      }
    },
    [queueCaret, applyPendingCaret],
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
      const provisional = mergePageIntoContent(valueRef.current, pageIdx, pageText);
      const globalCursor = pageStartOffset(valueRef.current, pageIdx) + localCursor;
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
    [editingElement, onChange, onElementChange, queueCaret, refreshSuggestions],
  );

  const handlePageChange = useCallback(
    (pageIdx: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      commitPageText(pageIdx, e.target.value, e.target.selectionStart);
    },
    [readOnly, commitPageText],
  );

  const handlePageKeyDown = useCallback(
    (pageIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = e.currentTarget;
      const content = valueRef.current;
      const globalStart = pageStartOffset(content, pageIdx) + el.selectionStart;
      const globalEnd = pageStartOffset(content, pageIdx) + el.selectionEnd;

      if (suggestions.length > 0) {
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
        if (e.key === "Escape") {
          e.preventDefault();
          dismissSuggestions();
          return;
        }
        if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          applySuggestion(suggestions[suggestionIndex] ?? suggestions[0]!, pageIdx);
          return;
        }
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          applySuggestion(suggestions[suggestionIndex] ?? suggestions[0]!, pageIdx);
          return;
        }
        // Backspace / Delete must never be trapped — let the textarea delete, then refresh via onChange.
        if (e.key === "Backspace" || e.key === "Delete") {
          bumpSuggestionIdle();
          // fall through — do not preventDefault
        }
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
        applyEdit(handleScreenplayEnter(content, globalStart, editingElement));
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        onBeforeChange?.();
        if (suggestions.length > 0) {
          applySuggestion(suggestions[suggestionIndex] ?? suggestions[0]!, pageIdx);
          return;
        }
        applyEdit(handleScreenplayTab(content, globalStart, e.shiftKey ? -1 : 1, editingElement));
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

      if (
        e.key === "ArrowUp" &&
        suggestions.length === 0 &&
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
        suggestions.length === 0 &&
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
    ],
  );

  const pageSurface =
    theme === "light"
      ? "bg-white border-slate-300 text-slate-900 shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
      : "bg-[#141416] border-slate-600 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.45)]";

  return (
    <div className="space-y-2">
      <div
        className="overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 sm:p-5"
        data-screenplay-scroll
        style={{ maxHeight: "min(82vh, 980px)" }}
      >
        <div className="relative mx-auto flex w-full max-w-[8.5in] flex-col items-center">
          {pageTexts.map((pageText, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className={`relative overflow-hidden rounded-sm border ${pageSurface}`}
              style={{
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                maxWidth: "100%",
                marginBottom: pageIdx < pageCount - 1 ? PAGE_GAP_PX : 0,
                boxSizing: "border-box",
              }}
            >
              <span
                className="pointer-events-none absolute bottom-3 right-4 z-[2] text-[10px] text-slate-500"
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
                  }, 180);
                }}
                readOnly={readOnly}
                spellCheck
                rows={LINES_PER_PAGE}
                wrap="soft"
                className={`relative z-[1] block resize-none border-0 bg-transparent outline-none focus:ring-0 ${className ?? ""}`}
                style={{
                  fontFamily: fontCss,
                  fontSize: `${Math.min(fontSizePt, 12)}pt`,
                  lineHeight: 1,
                  caretColor: theme === "light" ? "#0f172a" : "#f8fafc",
                  color: "inherit",
                  width: "100%",
                  height: "100%",
                  boxSizing: "border-box",
                  paddingTop: MARGIN_TOP,
                  paddingBottom: MARGIN_BOTTOM,
                  paddingLeft: MARGIN_LEFT,
                  paddingRight: MARGIN_RIGHT,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  overflowX: "hidden",
                  overflowY: "hidden",
                }}
                placeholder={pageIdx === 0 ? placeholder : undefined}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ))}

          {suggestions.length > 0 ? (
            <div
              className="absolute left-[1.5in] top-24 z-20 max-h-48 w-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-xl"
              role="listbox"
              aria-label="Screenplay suggestions"
              onMouseEnter={bumpSuggestionIdle}
              onMouseMove={bumpSuggestionIdle}
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === suggestionIndex}
                  className={`block w-full px-3 py-1.5 text-left text-xs ${
                    i === suggestionIndex
                      ? "bg-orange-500/20 text-orange-100"
                      : "text-slate-200 hover:bg-slate-800"
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
              ))}
              <p className="border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-500">
                Enter/Tab to use · Esc to close · fades after 3s idle
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          {pageCount} page{pageCount === 1 ? "" : "s"} · US Letter 8.5×11 · {SCREENPLAY_LINE_WIDTH}-char wrap ·{" "}
          <span className="text-orange-300/90">{editingElement.replace(/_/g, " ")}</span>
        </p>
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          Enter / Tab accept suggestions · Esc dismisses
        </p>
      </div>
    </div>
  );
}
