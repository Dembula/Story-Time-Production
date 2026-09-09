"use client";

import { useEffect, useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TreatmentSlideCanvas } from "./treatment-slide-canvas";
import type { TreatmentDocument } from "@/lib/treatment-studio/types";

type TreatmentPresenterProps = {
  document: TreatmentDocument;
  initialIndex?: number;
  onClose: () => void;
  projectId?: string;
};

function slideHasPlayableClip(
  document: TreatmentDocument,
  slideIndex: number,
): boolean {
  const slide = document.slides[slideIndex];
  if (!slide) return false;
  const assetById = new Map(document.assets.map((a) => [a.id, a]));
  const isVideo = (id: string | undefined) =>
    Boolean(id && assetById.get(id)?.type === "video");

  if (slide.referenceIds.some(isVideo)) return true;
  return slide.elements.some(
    (el) => el.type === "image" && isVideo(el.referenceId),
  );
}

export function TreatmentPresenter({
  document,
  initialIndex = 0,
  onClose,
  projectId,
}: TreatmentPresenterProps) {
  const slides = document.slides;
  const [index, setIndex] = useState(initialIndex);
  const [clipPlaying, setClipPlaying] = useState(false);

  const goPrev = useCallback(() => {
    setClipPlaying(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setClipPlaying(false);
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  useEffect(() => {
    setClipPlaying(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === " ") {
        e.preventDefault();
        if (slideHasPlayableClip(document, index)) {
          setClipPlaying((p) => !p);
        } else {
          goNext();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev, document, index]);

  const slide = slides[index];
  if (!slide) return null;

  const hasClip = slideHasPlayableClip(document, index);

  return (
    <div className="treatment-presenter fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm text-slate-400">
          Slide {index + 1} of {slides.length}
          {hasClip ? (
            <span className="ml-2 text-slate-500">
              · Tap slide to {clipPlaying ? "restart" : "play"} clip
            </span>
          ) : null}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-slate-300 hover:text-white"
        >
          <X className="mr-1.5 h-4 w-4" />
          Exit
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center bg-black p-6 md:p-12">
        <button
          type="button"
          className="treatment-presenter-stage w-full cursor-pointer border-0 bg-transparent p-0 text-left"
          onClick={() => {
            if (!hasClip) {
              goNext();
              return;
            }
            // Tap anywhere: play from start (or replay if already playing)
            setClipPlaying(false);
            requestAnimationFrame(() => setClipPlaying(true));
          }}
          aria-label={
            hasClip
              ? clipPlaying
                ? "Replay clip"
                : "Play clip"
              : "Next slide"
          }
        >
          <TreatmentSlideCanvas
            slide={slide}
            assets={document.assets}
            aspectRatio={document.settings.aspectRatio}
            readOnly
            presentMode
            clipPlaying={clipPlaying}
            selectedElementId={null}
            projectId={projectId}
            className="pointer-events-none shadow-2xl"
          />
        </button>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-white/10 px-4 py-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goPrev}
          disabled={index === 0}
          className="border-white/20 bg-transparent text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setClipPlaying(false);
                setIndex(i);
              }}
              className={[
                "h-2 w-2 rounded-full transition",
                i === index ? "bg-orange-400" : "bg-white/25 hover:bg-white/40",
              ].join(" ")}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goNext}
          disabled={index >= slides.length - 1}
          className="border-white/20 bg-transparent text-white hover:bg-white/10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
