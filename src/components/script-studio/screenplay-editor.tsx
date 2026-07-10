"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LINES_PER_PAGE,
  PAGE_GAP_PX,
  formatLineWhileTyping,
  handleScreenplayEnter,
  handleScreenplayTab,
  lineIndexAt,
  pageCountForContent,
  resolveLineElement,
} from "@/lib/script-studio/screenplay-keyboard";
import {
  getScreenplaySuggestions,
  type ScreenplaySuggestion,
} from "@/lib/script-studio/screenplay-autocomplete";
import type { ScreenplayElementType } from "@/lib/script-studio/types";

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
  const lineIdx = lineIndexAt(content, offset);
  return Math.floor(lineIdx / LINES_PER_PAGE);
}

function resizeTextarea(el: HTMLTextAreaElement, minHeightPx: number) {
  el.style.height = "auto";
  el.style.height = `${Math.max(minHeightPx, el.scrollHeight)}px`;
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
  lineHeight = 1.2,
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

  useEffect(() => {
    setEditingElement(activeElementProp);
  }, [activeElementProp]);

  const lineHeightPx = fontSizePt * lineHeight * (96 / 72);
  const pageContentHeight = LINES_PER_PAGE * lineHeightPx;
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

  useEffect(() => {
    pageRefs.current.forEach((el) => {
      if (el) resizeTextarea(el, pageContentHeight);
    });
  }, [pageTexts, pageContentHeight, fontSizePt, lineHeight]);

  const refreshSuggestions = useCallback(
    (content: string, globalCursor: number, element: ScreenplayElementType) => {
      const lineIdx = lineIndexAt(content, globalCursor);
      const line = content.split("\n")[lineIdx] ?? "";
      const next = getScreenplaySuggestions({ content, line, element });
      setSuggestions(next);
      setSuggestionIndex(0);
    },
    [],
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
    (globalOffset: number, selectionEnd = globalOffset, content = value) => {
      const pageIdx = pageIndexAtOffset(content, globalOffset);
      const localStart = globalOffset - pageStartOffset(content, pageIdx);
      setActivePageIdx(pageIdx);
      requestAnimationFrame(() => {
        const el = pageRefs.current[pageIdx];
        if (!el) return;
        const localEnd = selectionEnd - pageStartOffset(content, pageIdx);
        el.focus();
        el.setSelectionRange(localStart, localEnd);
        syncExternalRef(el);
      });
    },
    [value, syncExternalRef],
  );

  const applyEdit = useCallback(
    (result: {
      content: string;
      selectionStart: number;
      selectionEnd: number;
      element?: ScreenplayElementType;
    }) => {
      onChange(result.content);
      if (result.element) {
        setEditingElement(result.element);
        onElementChange?.(result.element);
        refreshSuggestions(result.content, result.selectionStart, result.element);
      } else {
        setSuggestions([]);
      }
      focusAt(result.selectionStart, result.selectionEnd, result.content);
    },
    [onChange, onElementChange, focusAt, refreshSuggestions],
  );

  const applySuggestion = useCallback(
    (suggestion: ScreenplaySuggestion, pageIdx: number) => {
      onBeforeChange?.();
      const el = pageRefs.current[pageIdx];
      if (!el) return;
      const globalCursor = pageStartOffset(value, pageIdx) + el.selectionStart;
      const lineIdx = lineIndexAt(value, globalCursor);
      const lines = value.split("\n");
      lines[lineIdx] = suggestion.insert;
      const newContent = lines.join("\n");
      let lineStart = 0;
      for (let i = 0; i < lineIdx; i++) {
        lineStart += (lines[i]?.length ?? 0) + 1;
      }
      const element = suggestion.element ?? editingElement;
      applyEdit({
        content: newContent,
        selectionStart: lineStart + suggestion.insert.length,
        selectionEnd: lineStart + suggestion.insert.length,
        element,
      });
      setSuggestions([]);
    },
    [value, editingElement, onBeforeChange, applyEdit],
  );

  const replacePageText = useCallback(
    (pageIdx: number, nextPageText: string) => {
      const lines = value.split("\n");
      const start = pageIdx * LINES_PER_PAGE;
      const before = lines.slice(0, start);
      const after = lines.slice(start + LINES_PER_PAGE);
      const inserted = nextPageText.split("\n");
      onChange([...before, ...inserted, ...after].join("\n"));
    },
    [value, onChange],
  );

  const handlePageChange = useCallback(
    (pageIdx: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = e.target;
      const raw = e.target.value;

      // Map page-local content back into full document for formatting helpers
      const before = value.slice(0, pageStartOffset(value, pageIdx));
      const afterStart = pageStartOffset(value, pageIdx) + (pageTexts[pageIdx]?.length ?? 0);
      const after = value.slice(afterStart);
      const provisional = before + raw + after;
      const localCursor = el.selectionStart;
      const globalCursor = pageStartOffset(value, pageIdx) + localCursor;

      const formatted = formatLineWhileTyping(provisional, globalCursor, editingElement);
      if (formatted) {
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
        requestAnimationFrame(() => {
          focusAt(formatted.selectionStart, formatted.selectionEnd, formatted.content);
        });
        return;
      }

      replacePageText(pageIdx, raw);
      const nextGlobal = pageStartOffset(value, pageIdx) + localCursor;
      refreshSuggestions(provisional, nextGlobal, editingElement);
      requestAnimationFrame(() => {
        focusAt(nextGlobal, nextGlobal, provisional);
      });
    },
    [
      readOnly,
      value,
      pageTexts,
      editingElement,
      onChange,
      onElementChange,
      replacePageText,
      focusAt,
      refreshSuggestions,
    ],
  );

  const handlePageKeyDown = useCallback(
    (pageIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = e.currentTarget;
      const globalStart = pageStartOffset(value, pageIdx) + el.selectionStart;
      const globalEnd = pageStartOffset(value, pageIdx) + el.selectionEnd;

      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSuggestionIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSuggestionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSuggestions([]);
          return;
        }
        if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          applySuggestion(suggestions[suggestionIndex] ?? suggestions[0]!, pageIdx);
          return;
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
        const next = value.slice(0, globalStart) + e.key.toUpperCase() + value.slice(globalEnd);
        const formatted = formatLineWhileTyping(next, globalStart + 1, "character");
        if (formatted) {
          applyEdit({
            content: formatted.content,
            selectionStart: formatted.selectionStart,
            selectionEnd: formatted.selectionEnd,
            element: formatted.element ?? "character",
          });
        } else {
          onChange(next);
          focusAt(globalStart + 1, globalStart + 1, next);
        }
        return;
      }

      // Typing "(" switches to parenthetical
      if (e.key === "(" && editingElement !== "character" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onBeforeChange?.();
        const next = value.slice(0, globalStart) + "(" + value.slice(globalEnd);
        const formatted = formatLineWhileTyping(next, globalStart + 1, "parenthetical");
        if (formatted) {
          applyEdit({
            ...formatted,
            element: "parenthetical",
          });
        } else {
          applyEdit({
            content: next,
            selectionStart: globalStart + 1,
            selectionEnd: globalStart + 1,
            element: "parenthetical",
          });
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onBeforeChange?.();
        const result = handleScreenplayEnter(value, globalStart, editingElement);
        applyEdit(result);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        onBeforeChange?.();
        if (suggestions.length > 0) {
          applySuggestion(suggestions[suggestionIndex] ?? suggestions[0]!, pageIdx);
          return;
        }
        const result = handleScreenplayTab(value, globalStart, e.shiftKey ? -1 : 1, editingElement);
        applyEdit(result);
        return;
      }

      if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && pageIdx > 0) {
        e.preventDefault();
        onBeforeChange?.();
        focusAt(pageStartOffset(value, pageIdx) - 1);
      }

      if (e.key === "ArrowUp" && suggestions.length === 0 && el.selectionStart === 0 && el.selectionEnd === 0 && pageIdx > 0) {
        e.preventDefault();
        const prevEl = pageRefs.current[pageIdx - 1];
        if (!prevEl) return;
        focusAt(pageStartOffset(value, pageIdx - 1) + prevEl.value.length);
      }

      if (
        e.key === "ArrowDown" &&
        suggestions.length === 0 &&
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length &&
        pageIdx < pageCount - 1
      ) {
        e.preventDefault();
        focusAt(pageStartOffset(value, pageIdx + 1));
      }
    },
    [
      readOnly,
      value,
      pageCount,
      editingElement,
      suggestions,
      suggestionIndex,
      onBeforeChange,
      applyEdit,
      applySuggestion,
      onChange,
      focusAt,
    ],
  );

  const pageSurface =
    theme === "light"
      ? "bg-white border-slate-200 text-slate-900 shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
      : "bg-[#101012] border-slate-700/80 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.45)]";

  const sharedTextStyle = {
    fontFamily: fontCss,
    fontSize: `${fontSizePt}pt`,
    lineHeight,
    caretColor: theme === "light" ? "#0f172a" : "#f8fafc",
    // Industry page margins: 1.5" left, 1" right, ~1" top/bottom
    paddingLeft: "1.5in",
    paddingRight: "1in",
    paddingTop: "1in",
    paddingBottom: "1in",
  } as const;

  return (
    <div className="space-y-2">
      <div
        className="overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-4"
        data-screenplay-scroll
        style={{ maxHeight: "min(78vh, 920px)" }}
      >
        <div className="relative mx-auto w-full max-w-[8.5in] space-y-0">
          {pageTexts.map((pageText, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className="relative overflow-hidden"
              style={{ marginBottom: pageIdx < pageCount - 1 ? PAGE_GAP_PX : 0 }}
            >
              <div
                className={`pointer-events-none absolute inset-0 rounded-sm border ${pageSurface}`}
                aria-hidden
              >
                <span
                  className="absolute bottom-3 right-4 text-[10px] text-slate-500"
                  style={{ fontFamily: fontCss }}
                >
                  {pageIdx + 1}.
                </span>
              </div>

              <textarea
                ref={(el) => {
                  pageRefs.current[pageIdx] = el;
                  if (pageIdx === activePageIdx) syncExternalRef(el);
                  if (el) resizeTextarea(el, pageContentHeight);
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
                  // Delay so suggestion click can register
                  setTimeout(() => setSuggestions([]), 150);
                }}
                readOnly={readOnly}
                spellCheck
                rows={LINES_PER_PAGE}
                className={`relative z-[1] block w-full resize-none overflow-hidden border-0 bg-transparent px-0 outline-none focus:ring-0 whitespace-pre ${className ?? ""}`}
                style={{
                  ...sharedTextStyle,
                  color: "inherit",
                  minHeight: `${pageContentHeight}px`,
                }}
                placeholder={pageIdx === 0 ? placeholder : undefined}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          ))}

          {suggestions.length > 0 && activePageIdx >= 0 ? (
            <div
              className="absolute left-[1.5in] z-20 mt-1 max-h-48 w-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-xl"
              style={{ top: "auto" }}
              role="listbox"
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(s, activePageIdx);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          {pageCount} page{pageCount === 1 ? "" : "s"} · ~{pageCount} min ·{" "}
          <span className="text-orange-300/90">{editingElement.replace(/_/g, " ")}</span>
        </p>
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          Enter advances · Tab cycles · Type int/cut/( for smart format · ↑↓ suggestions
        </p>
      </div>
    </div>
  );
}
