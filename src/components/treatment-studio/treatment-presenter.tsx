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

export function TreatmentPresenter({
  document,
  initialIndex = 0,
  onClose,
  projectId,
}: TreatmentPresenterProps) {
  const slides = document.slides;
  const [index, setIndex] = useState(initialIndex);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div className="treatment-presenter fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm text-slate-400">
          Slide {index + 1} of {slides.length}
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

      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="treatment-presenter-stage w-full max-w-6xl">
          <TreatmentSlideCanvas
            slide={slide}
            assets={document.assets}
            aspectRatio={document.settings.aspectRatio}
            readOnly
            projectId={projectId}
            className="shadow-2xl"
          />
        </div>
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
              onClick={() => setIndex(i)}
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
