"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  LINES_PER_PAGE,
  handleScreenplayEnter,
  handleScreenplayTab,
  paginateLineIndices,
} from "@/lib/script-studio/screenplay-keyboard";
import type { ScreenplayElementType } from "@/lib/script-studio/types";

type ScreenplayEditorProps = {
  value: string;
  onChange: (value: string) => void;
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
};

export function ScreenplayEditor({
  value,
  onChange,
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
}: ScreenplayEditorProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (externalRef) externalRef.current = el;
    },
    [externalRef],
  );

  const lineHeightPx = fontSizePt * lineHeight * (96 / 72);
  const pageBreaks = useMemo(() => paginateLineIndices(value), [value]);
  const pageCount = Math.max(1, Math.ceil(value.split("\n").length / LINES_PER_PAGE));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;
      const el = internalRef.current;
      if (!el) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onBeforeChange?.();
        const result = handleScreenplayEnter(value, el.selectionStart);
        onChange(result.content);
        onElementChange?.(result.element);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(result.selectionStart, result.selectionEnd);
        });
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        onBeforeChange?.();
        const result = handleScreenplayTab(value, el.selectionStart, e.shiftKey ? -1 : 1);
        onChange(result.content);
        onElementChange?.(result.element);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(result.selectionStart, result.selectionEnd);
        });
      }
    },
    [readOnly, value, onChange, onElementChange, onBeforeChange],
  );

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
        aria-hidden
      >
        {pageBreaks.map((lineIdx, pageIdx) => (
          <div
            key={`page-break-${lineIdx}`}
            className="absolute left-0 right-0 border-t border-dashed border-slate-600/35"
            style={{ top: `${lineIdx * lineHeightPx}px` }}
          >
            <span
              className="absolute right-0 -top-4 text-[9px] text-slate-500/80 pr-1"
              style={{ fontFamily: fontCss }}
            >
              {pageIdx + 2}.
            </span>
          </div>
        ))}
        <div
          className="absolute right-0 top-0 text-[9px] text-slate-500/80 pr-1"
          style={{ fontFamily: fontCss }}
        >
          1.
        </div>
      </div>

      <textarea
        ref={setTextareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onSelect={onSelect}
        readOnly={readOnly}
        spellCheck
        rows={20}
        className={className}
        style={{
          fontFamily: fontCss,
          fontSize: `${fontSizePt}pt`,
          lineHeight,
          color: "inherit",
          paddingLeft: "0",
          paddingRight: "0",
        }}
        placeholder={placeholder}
      />

      <p className="mt-2 text-[10px] text-slate-500 text-right" style={{ fontFamily: fontCss }}>
        {pageCount} page{pageCount === 1 ? "" : "s"} · Enter / Tab to format · Shift+Tab cycles elements
      </p>
    </div>
  );
}
