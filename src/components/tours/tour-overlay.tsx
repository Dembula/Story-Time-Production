"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TourDefinition, TourStep } from "@/lib/tours/types";

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: Element | null): Rect | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function TourOverlay({
  tour,
  stepIndex,
  step,
  targetEl,
  onNext,
  onBack,
  onSkip,
}: {
  tour: TourDefinition;
  stepIndex: number;
  step: TourStep;
  targetEl: HTMLElement | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const total = tour.steps.length;
  const isLast = stepIndex >= total - 1;

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const update = () => setRect(measure(targetEl));
    update();
    if (!targetEl) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(targetEl);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [targetEl, stepIndex]);

  if (!mounted) return null;

  const pad = 8;
  const hole = rect
    ? {
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tooltipWidth = 320;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;

  let tipTop = 96;
  let tipLeft = clamp((viewportW - tooltipWidth) / 2, 12, viewportW - tooltipWidth - 12);

  if (hole) {
    const preferBottom = hole.top + hole.height + 16 + 200 < viewportH;
    tipTop = preferBottom
      ? hole.top + hole.height + 14
      : Math.max(12, hole.top - 14 - 180);
    tipLeft = clamp(hole.left + hole.width / 2 - tooltipWidth / 2, 12, viewportW - tooltipWidth - 12);
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="st-tour-title">
      {/* Dim layer with spotlight cutout via box-shadow on highlight frame */}
      <div className="absolute inset-0 bg-black/45 pointer-events-auto" onClick={onSkip} aria-hidden />
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-orange-400/90 transition-all duration-300"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      ) : null}

      <div
        className="absolute z-[91] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/12 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md"
        style={{ top: tipTop, left: tipLeft }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">
              {tour.title}
            </p>
            <h3 id="st-tour-title" className="mt-0.5 text-sm font-semibold text-white">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Skip tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-slate-300">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[11px] tabular-nums text-slate-500">
            {stepIndex + 1} of {total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
            >
              Skip
            </button>
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-400"
            >
              {isLast ? "Done" : "Next"}
              {!isLast ? <ChevronRight className="h-3.5 w-3.5" /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
