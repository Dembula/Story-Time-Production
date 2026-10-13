"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StoryboardPresentFrame = {
  id: string;
  shotLabel?: string | null;
  sceneHeading?: string | null;
  sceneNumber?: string | null;
  directorNotes?: string | null;
  imageUrl?: string | null;
  generationStatus?: string | null;
};

type StoryboardPresenterProps = {
  title: string;
  subtitle?: string | null;
  frames: StoryboardPresentFrame[];
  initialIndex?: number;
  onClose: () => void;
};

export function StoryboardPresenter({
  title,
  subtitle,
  frames,
  initialIndex = 0,
  onClose,
}: StoryboardPresenterProps) {
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, frames.length - 1)),
  );
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(frames.length - 1, i + 1));
  }, [frames.length]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, frames.length - 1)));
  }, [frames.length]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setIndex(Math.max(0, frames.length - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev, frames.length]);

  if (frames.length === 0) return null;

  const frame = frames[index] ?? frames[0];
  const label =
    frame.shotLabel ||
    (frame.sceneNumber ? `Scene ${frame.sceneNumber}` : `Shot ${index + 1}`);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Storyboard presentation"
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 48) return;
        if (delta < 0) goNext();
        else goPrev();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="truncate text-xs text-slate-400">
            {subtitle ? `${subtitle} · ` : null}
            Slide {index + 1} of {frames.length}
            {label ? ` · ${label}` : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
          Exit
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 py-6 md:px-16">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-2 text-white hover:bg-black/80 disabled:opacity-30 md:left-4"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-4">
          <div className="relative flex max-h-[min(78vh,900px)] w-full flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b]">
            {frame.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={frame.imageUrl}
                alt={label}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="px-6 text-center text-sm text-slate-500">
                {frame.generationStatus === "GENERATING"
                  ? "Generating…"
                  : "No image for this slide yet"}
              </div>
            )}
          </div>
          <div className="w-full max-w-3xl space-y-1 text-center">
            <p className="text-base font-medium text-white">{label}</p>
            {frame.sceneHeading ? (
              <p className="text-sm text-slate-400">{frame.sceneHeading}</p>
            ) : null}
            {frame.directorNotes ? (
              <p className="text-xs text-slate-500">{frame.directorNotes}</p>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={index >= frames.length - 1}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-2 text-white hover:bg-black/80 disabled:opacity-30 md:right-4"
          aria-label="Next slide"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-white/10 px-4 py-3">
        {frames.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index ? "w-6 bg-orange-400" : "w-1.5 bg-white/25 hover:bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
