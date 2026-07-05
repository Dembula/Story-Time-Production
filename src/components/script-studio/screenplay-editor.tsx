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
    },
    [value, editingElement, onElementChange],
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
      }
      focusAt(result.selectionStart, result.selectionEnd, result.content);
    },
    [onChange, onElementChange, focusAt],
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
      const globalStart = pageStartOffset(value, pageIdx) + el.selectionStart;

      const formatted = formatLineWhileTyping(raw, el.selectionStart, editingElement);
      if (formatted) {
        const before = value.slice(0, pageStartOffset(value, pageIdx));
        const afterStart = pageStartOffset(value, pageIdx) + pageTexts[pageIdx]!.length;
        const after = value.slice(afterStart);
        const nextContent = before + formatted.content + after;
        onChange(nextContent);
        requestAnimationFrame(() => {
          focusAt(
            pageStartOffset(nextContent, pageIdx) + formatted.selectionStart,
            pageStartOffset(nextContent, pageIdx) + formatted.selectionEnd,
          );
        });
        return;
      }

      replacePageText(pageIdx, raw);
      requestAnimationFrame(() => {
        focusAt(globalStart);
      });
    },
    [readOnly, value, pageTexts, editingElement, onChange, replacePageText, focusAt],
  );

  const handlePageKeyDown = useCallback(
    (pageIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = e.currentTarget;
      const globalStart = pageStartOffset(value, pageIdx) + el.selectionStart;
      const globalEnd = pageStartOffset(value, pageIdx) + el.selectionEnd;

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
        const formatted = formatLineWhileTyping(
          next.slice(pageStartOffset(value, pageIdx)),
          el.selectionStart + 1,
          "character",
        );
        if (formatted) {
          const before = value.slice(0, pageStartOffset(value, pageIdx));
          const afterStart = pageStartOffset(value, pageIdx) + pageTexts[pageIdx]!.length;
          applyEdit({
            content: before + formatted.content + value.slice(afterStart),
            selectionStart: pageStartOffset(value, pageIdx) + formatted.selectionStart,
            selectionEnd: pageStartOffset(value, pageIdx) + formatted.selectionEnd,
            element: "character",
          });
        } else {
          onChange(next);
          focusAt(globalStart + 1);
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
        const result = handleScreenplayTab(value, globalStart, e.shiftKey ? -1 : 1, editingElement);
        applyEdit(result);
        return;
      }

      if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && pageIdx > 0) {
        e.preventDefault();
        onBeforeChange?.();
        const mergeAt = pageStartOffset(value, pageIdx);
        focusAt(mergeAt - 1);
      }

      if (e.key === "ArrowUp" && el.selectionStart === 0 && el.selectionEnd === 0 && pageIdx > 0) {
        e.preventDefault();
        const prevEl = pageRefs.current[pageIdx - 1];
        if (!prevEl) return;
        const pos = prevEl.value.length;
        focusAt(pageStartOffset(value, pageIdx - 1) + pos);
      }

      if (
        e.key === "ArrowDown" &&
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
      pageTexts,
      pageCount,
      editingElement,
      onBeforeChange,
      applyEdit,
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
    paddingLeft: "1.5in",
    paddingRight: "1in",
    paddingTop: "0.65in",
    paddingBottom: "0.5in",
  } as const;

  return (
    <div className="space-y-2">
      <div
        className="overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-4"
        data-screenplay-scroll
        style={{ maxHeight: "min(78vh, 920px)" }}
      >
        <div className="mx-auto w-full max-w-[8.5in] space-y-0">
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
                  className="absolute bottom-2 right-3 text-[10px] text-slate-500"
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
                readOnly={readOnly}
                spellCheck
                rows={LINES_PER_PAGE}
                className={`relative z-[1] block w-full resize-none overflow-hidden border-0 bg-transparent px-0 outline-none focus:ring-0 whitespace-pre-wrap break-words ${className ?? ""}`}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          {pageCount} page{pageCount === 1 ? "" : "s"} ·{" "}
          <span className="text-orange-300/90">{editingElement.replace(/_/g, " ")}</span>
        </p>
        <p className="text-[10px] text-slate-500" style={{ fontFamily: fontCss }}>
          Enter / Tab to format · Shift+Tab cycles elements · Character names auto-capitalize
        </p>
      </div>
    </div>
  );
}
