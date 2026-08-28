"use client";

import { SecureImage } from "@/components/files/secure-image";
import { cn } from "@/lib/utils";
import type {
  TreatmentAsset,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "@/lib/treatment-studio/types";

type TreatmentSlideCanvasProps = {
  slide: TreatmentSlide;
  assets: TreatmentAsset[];
  aspectRatio?: "16:9" | "4:3";
  readOnly?: boolean;
  className?: string;
  onFieldChange?: (patch: Partial<TreatmentSlide>) => void;
};

function assetMap(assets: TreatmentAsset[]) {
  return new Map(assets.map((a) => [a.id, a]));
}

function SlideReferences({
  referenceIds,
  assets,
  compact,
}: {
  referenceIds: string[];
  assets: TreatmentAsset[];
  compact?: boolean;
}) {
  const map = assetMap(assets);
  const refs = referenceIds.map((id) => map.get(id)).filter(Boolean) as TreatmentAsset[];
  if (refs.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-300/80 bg-slate-50 text-sm text-slate-400">
        Add references from Assets
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {refs.map((ref) => (
        <figure key={ref.id} className="overflow-hidden rounded-md bg-slate-100">
          {ref.type === "image" ? (
            <SecureImage
              fileRef={ref.url}
              alt={ref.title || "Reference"}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-slate-200 px-2 text-center text-xs text-slate-600">
              {ref.title || ref.url}
            </div>
          )}
          {ref.caption ? (
            <figcaption className="px-2 py-1 text-[10px] text-slate-500 line-clamp-2">
              {ref.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

function EditableText({
  value,
  placeholder,
  className,
  multiline,
  readOnly,
  onChange,
}: {
  value: string;
  placeholder: string;
  className?: string;
  multiline?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  if (readOnly) {
    return <div className={className}>{value || placeholder}</div>;
  }
  if (multiline) {
    return (
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full resize-none border-0 bg-transparent outline-none placeholder:text-slate-400 focus:ring-0",
          className,
        )}
        rows={6}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        "w-full border-0 bg-transparent outline-none placeholder:text-slate-400 focus:ring-0",
        className,
      )}
    />
  );
}

function layoutContent(
  layout: TreatmentSlideLayout,
  slide: TreatmentSlide,
  assets: TreatmentAsset[],
  readOnly: boolean,
  onFieldChange?: (patch: Partial<TreatmentSlide>) => void,
) {
  const change = (patch: Partial<TreatmentSlide>) => {
    if (!readOnly) onFieldChange?.(patch);
  };

  switch (layout) {
    case "title":
      return (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <EditableText
            value={slide.title}
            placeholder="Project Title"
            readOnly={readOnly}
            onChange={(title) => change({ title })}
            className="text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl"
          />
          <EditableText
            value={slide.subtitle ?? ""}
            placeholder="Subtitle or byline"
            readOnly={readOnly}
            onChange={(subtitle) => change({ subtitle })}
            className="mt-4 text-lg text-slate-600 md:text-xl"
          />
        </div>
      );
    case "split": {
      const map = assetMap(assets);
      const heroRef = slide.referenceIds[0]
        ? map.get(slide.referenceIds[0])
        : undefined;
      return (
        <div className="grid h-full grid-cols-1 gap-6 p-8 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <EditableText
              value={slide.title}
              placeholder="Section title"
              readOnly={readOnly}
              onChange={(title) => change({ title })}
              className="text-2xl font-semibold text-slate-900"
            />
            <EditableText
              value={slide.body ?? ""}
              placeholder="Describe the visual direction..."
              multiline
              readOnly={readOnly}
              onChange={(body) => change({ body })}
              className="mt-4 text-sm leading-relaxed text-slate-700"
            />
          </div>
          <div className="flex items-center justify-center">
            {heroRef?.type === "image" ? (
              <SecureImage
                fileRef={heroRef.url}
                alt={heroRef.title || "Reference"}
                className="max-h-full w-full rounded-lg object-cover shadow-md"
              />
            ) : (
              <SlideReferences
                referenceIds={slide.referenceIds.slice(0, 1)}
                assets={assets}
                compact
              />
            )}
          </div>
        </div>
      );
    }
    case "image": {
      const map = assetMap(assets);
      const heroRef = slide.referenceIds[0]
        ? map.get(slide.referenceIds[0])
        : undefined;
      return (
        <div className="relative flex h-full flex-col">
          {heroRef?.type === "image" ? (
            <SecureImage
              fileRef={heroRef.url}
              alt={heroRef.title || "Reference"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-slate-100 text-slate-400">
              Select a reference image
            </div>
          )}
          {(slide.title || !readOnly) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <EditableText
                value={slide.title}
                placeholder="Caption"
                readOnly={readOnly}
                onChange={(title) => change({ title })}
                className="text-lg font-medium text-white"
              />
            </div>
          )}
        </div>
      );
    }
    case "references":
      return (
        <div className="flex h-full flex-col p-8">
          <EditableText
            value={slide.title}
            placeholder="References"
            readOnly={readOnly}
            onChange={(title) => change({ title })}
            className="mb-4 text-2xl font-semibold text-slate-900"
          />
          <SlideReferences referenceIds={slide.referenceIds} assets={assets} />
        </div>
      );
    case "blank":
      return (
        <div className="flex h-full items-center justify-center p-8 text-sm text-slate-400">
          {readOnly ? null : "Blank canvas — add references or switch layout"}
        </div>
      );
    case "content":
    default:
      return (
        <div className="flex h-full flex-col p-8 md:p-12">
          <EditableText
            value={slide.title}
            placeholder="Slide title"
            readOnly={readOnly}
            onChange={(title) => change({ title })}
            className="text-2xl font-semibold text-slate-900 md:text-3xl"
          />
          <EditableText
            value={slide.body ?? ""}
            placeholder="Write your treatment copy..."
            multiline
            readOnly={readOnly}
            onChange={(body) => change({ body })}
            className="mt-6 flex-1 text-sm leading-relaxed text-slate-700 md:text-base"
          />
        </div>
      );
  }
}

export function TreatmentSlideCanvas({
  slide,
  assets,
  aspectRatio = "16:9",
  readOnly = false,
  className,
  onFieldChange,
}: TreatmentSlideCanvasProps) {
  return (
    <div
      className={cn(
        "treatment-slide-canvas overflow-hidden rounded-sm bg-white text-slate-900",
        aspectRatio === "16:9" ? "aspect-video" : "aspect-[4/3]",
        className,
      )}
      style={{ backgroundColor: slide.backgroundColor ?? "#ffffff" }}
    >
      {layoutContent(slide.layout, slide, assets, readOnly, onFieldChange)}
    </div>
  );
}

/** Mini thumbnail for slide navigator */
export function TreatmentSlideThumbnail({
  slide,
  assets,
  index,
  active,
  onClick,
}: {
  slide: TreatmentSlide;
  assets: TreatmentAsset[];
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "treatment-slide-thumb group relative w-full overflow-hidden rounded-md border transition",
        active
          ? "border-orange-400/60 ring-1 ring-orange-400/30"
          : "border-white/10 hover:border-white/25",
      )}
    >
      <div className="pointer-events-none scale-[0.22] origin-top-left w-[454%]">
        <TreatmentSlideCanvas slide={slide} assets={assets} readOnly />
      </div>
      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {index + 1}
      </span>
    </button>
  );
}
