"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LINES_PER_PAGE,
  PAGE_GAP_PX,
  detectLineElement,
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
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [editingElement, setEditingElement] = useState<ScreenplayElementType>(activeElementProp);

  useEffect(() => {
    setEditingElement(activeElementProp);
  }, [activeElementProp]);

  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (externalRef) externalRef.current = el;
    },
    [externalRef],
  );

  const lineHeightPx = fontSizePt * lineHeight * (96 / 72);
  const pageContentHeight = LINES_PER_PAGE * lineHeightPx;
  const pageCount = pageCountForContent(value);
  const totalHeight = pageCount * pageContentHeight + Math.max(0, pageCount - 1) * PAGE_GAP_PX;

  const syncElementFromCursor = useCallback(() => {
    const el = internalRef.current;
    if (!el) return;
    const lineIdx = lineIndexAt(value, el.selectionStart);
    const lines = value.split("\n");
    const element = resolveLineElement(lines[lineIdx] ?? "", {
      prev: lineIdx > 0 ? lines[lineIdx - 1] : undefined,
      next: lineIdx < lines.length - 1 ? lines[lineIdx + 1] : undefined,
    }, editingElement);
    setEditingElement(element);
    onElementChange?.(element);
  }, [value, editingElement, onElementChange]);

  const applyEdit = useCallback(
    (result: { content: string; selectionStart: number; selectionEnd: number; element?: ScreenplayElementType }) => {
      onChange(result.content);
      if (result.element) {
        setEditingElement(result.element);
        onElementChange?.(result.element);
      }
      requestAnimationFrame(() => {
        const el = internalRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [onChange, onElementChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = internalRef.current;
      const raw = e.target.value;
      if (!el) {
        onChange(raw);
        return;
      }

      const formatted = formatLineWhileTyping(raw, el.selectionStart, editingElement);
      if (formatted) {
        onChange(formatted.content);
        requestAnimationFrame(() => {
          el.setSelectionRange(formatted.selectionStart, formatted.selectionEnd);
        });
        return;
      }

      onChange(raw);
    },
    [readOnly, onChange, editingElement],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = internalRef.current;
      if (!el) return;

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
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const next = value.slice(0, start) + e.key.toUpperCase() + value.slice(end);
        const formatted = formatLineWhileTyping(next, start + 1, "character");
        if (formatted) {
          applyEdit({ ...formatted, element: "character" });
        } else {
          onChange(next);
          requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onBeforeChange?.();
        const result = handleScreenplayEnter(value, el.selectionStart, editingElement);
        applyEdit(result);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        onBeforeChange?.();
        const result = handleScreenplayTab(value, el.selectionStart, e.shiftKey ? -1 : 1, editingElement);
        applyEdit(result);
      }
    },
    [readOnly, value, editingElement, onBeforeChange, applyEdit, onChange],
  );

  const gapMaskClass = theme === "light" ? "bg-slate-100" : "bg-slate-950/70";
  const pageSurface =
    theme === "light"
      ? "bg-white border-slate-200 text-slate-900 shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
      : "bg-[#101012] border-slate-700/80 text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.45)]";

  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i), [pageCount]);

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-4"
        data-screenplay-scroll
        style={{ maxHeight: "min(78vh, 920px)" }}
      >
        <div className="relative mx-auto w-full max-w-[8.5in]">
          {pages.map((pageIdx) => (
            <div key={`page-${pageIdx}`}>
              <div
                className={`pointer-events-none absolute left-0 right-0 rounded-sm border ${pageSurface}`}
                style={{
                  top: pageIdx * (pageContentHeight + PAGE_GAP_PX),
                  height: pageContentHeight,
                }}
              >
                <span
                  className="absolute bottom-2 right-3 text-[10px] text-slate-500"
                  style={{ fontFamily: fontCss }}
                >
                  {pageIdx + 1}.
                </span>
              </div>
              {pageIdx < pageCount - 1 ? (
                <div
                  className={`pointer-events-none absolute left-0 right-0 z-[2] ${gapMaskClass}`}
                  style={{
                    top: pageIdx * (pageContentHeight + PAGE_GAP_PX) + pageContentHeight,
                    height: PAGE_GAP_PX,
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
          ))}

          <textarea
            ref={setTextareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={() => {
              syncElementFromCursor();
              onSelect?.();
            }}
            onClick={syncElementFromCursor}
            readOnly={readOnly}
            spellCheck
            rows={LINES_PER_PAGE}
            className={`relative z-[1] block w-full resize-none overflow-hidden border-0 bg-transparent px-0 outline-none focus:ring-0 whitespace-pre-wrap ${className ?? ""}`}
            style={{
              fontFamily: fontCss,
              fontSize: `${fontSizePt}pt`,
              lineHeight,
              color: "inherit",
              minHeight: `${totalHeight}px`,
              height: `${totalHeight}px`,
              caretColor: theme === "light" ? "#0f172a" : "#f8fafc",
              paddingLeft: "1.5in",
              paddingRight: "1in",
              paddingTop: "0.65in",
            }}
            placeholder={placeholder}
            autoCapitalize="off"
            autoCorrect="off"
          />
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
