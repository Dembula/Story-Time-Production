"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, RotateCcw, X } from "lucide-react";
import { formatDurationMss } from "@/lib/cont-sheet/types";

type ContSheetStopwatchProps = {
  selectedTakeLabel?: string | null;
  onCommitDuration: (durationSec: number) => void;
  /** When false, stopwatch is not interactive for commit (still visible). */
  canCommit?: boolean;
  onClose?: () => void;
};

const STORAGE_KEY = "st-cont-sheet-stopwatch-pos";
const W = 190;
const H = 320;

function clampPos(x: number, y: number) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(8, window.innerWidth - W - 8);
  const maxY = Math.max(8, window.innerHeight - H - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

function loadPos(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clampPos(window.innerWidth - W - 24, 96);
    }
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    return clampPos(
      typeof parsed.x === "number" ? parsed.x : window.innerWidth - W - 24,
      typeof parsed.y === "number" ? parsed.y : 96,
    );
  } catch {
    return clampPos(window.innerWidth - W - 24, 96);
  }
}

export function ContSheetStopwatch({
  selectedTakeLabel,
  onCommitDuration,
  canCommit = true,
  onClose,
}: ContSheetStopwatchProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(0);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    setMounted(true);
    setPos(loadPos());
  }, []);

  useLayoutEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tick = useCallback(() => {
    if (startedAtRef.current == null) return;
    setElapsedMs(baseElapsedRef.current + (performance.now() - startedAtRef.current));
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [running, tick]);

  const start = useCallback(() => {
    if (running) return;
    startedAtRef.current = performance.now();
    setRunning(true);
  }, [running]);

  const stop = useCallback(() => {
    if (!running) return;
    const now = performance.now();
    const next = baseElapsedRef.current + (now - (startedAtRef.current ?? now));
    baseElapsedRef.current = next;
    startedAtRef.current = null;
    setElapsedMs(next);
    setRunning(false);
    const sec = Math.max(0, Math.round(next / 1000));
    if (canCommit && sec > 0) onCommitDuration(sec);
  }, [running, canCommit, onCommitDuration]);

  const toggle = useCallback(() => {
    if (running) stop();
    else start();
  }, [running, start, stop]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    baseElapsedRef.current = 0;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      if (e.key !== "s" && e.key !== "S") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const editable =
        tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable;
      if (editable && !canCommit) return;
      if (editable && tag === "textarea") return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, canCommit]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-sw-no-drag]")) return;
    const el = rootRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    setPos(clampPos(dragRef.current.px + dx, dragRef.current.py + dy));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      rootRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
  };

  const sec = elapsedMs / 1000;
  const angle = (sec % 60) * 6;
  const digital = formatDurationMss(Math.floor(sec)) || "0:00";
  const tenths = Math.floor((elapsedMs % 1000) / 100);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[9999] w-[190px] select-none touch-none"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-zinc-700 via-zinc-900 to-black shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] ring-1 ring-orange-500/20">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-1.5 cursor-grab active:cursor-grabbing">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200/90">
            Stopwatch
          </p>
          <div className="flex items-center gap-0.5" data-sw-no-drag>
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Stopwatch help"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close stopwatch"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative mx-auto mt-3 flex h-[132px] w-[132px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#3f3f46,#18181b_55%,#09090b)] shadow-[inset_0_0_24px_rgba(0,0,0,0.65)] ring-2 ring-zinc-600/80">
          <div className="absolute inset-2 rounded-full border border-white/10" />
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
            <div
              key={m}
              className="absolute left-1/2 top-1/2 h-[58px] w-[2px] origin-bottom"
              style={{ transform: `translate(-50%, -100%) rotate(${m * 6}deg)` }}
            >
              <div
                className={`mx-auto ${m % 15 === 0 ? "h-3 w-[2px] bg-orange-300" : "h-2 w-px bg-zinc-500"}`}
              />
            </div>
          ))}
          <div
            className="absolute left-1/2 top-1/2 z-10 h-[50px] w-[2px] origin-bottom rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
            style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
          />
          <div className="absolute left-1/2 top-1/2 z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-300 ring-2 ring-zinc-900" />
        </div>

        <div className="px-3 pb-3 pt-2 text-center" data-sw-no-drag>
          <p className="font-mono text-2xl font-semibold tracking-tight text-white">
            {digital}
            <span className="text-sm text-slate-500">.{tenths}</span>
          </p>
          <p className="mt-1 truncate text-[10px] text-slate-400">
            {selectedTakeLabel ? `Target: ${selectedTakeLabel}` : "Select a take row to fill time"}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                running
                  ? "bg-red-500 text-white"
                  : "bg-orange-500 text-slate-950 hover:bg-orange-400"
              }`}
            >
              {running ? "Stop" : "Start"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
              aria-label="Reset"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Shift + S to start/stop</p>
        </div>

        {helpOpen ? (
          <div
            className="border-t border-white/10 bg-black/70 px-3 py-2 text-[11px] leading-relaxed text-slate-300"
            data-sw-no-drag
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-white">How to use</span>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-slate-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Click a take row so it is selected.</li>
              <li>
                Press{" "}
                <kbd className="rounded bg-white/10 px-1">Shift</kbd> +{" "}
                <kbd className="rounded bg-white/10 px-1">S</kbd> (or Start) when the slate rolls.
              </li>
              <li>Press again to stop — time fills that take and updates totals.</li>
              <li>Drag the header to move anywhere on screen. Close with ×; reopen from the toolbar.</li>
            </ol>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
