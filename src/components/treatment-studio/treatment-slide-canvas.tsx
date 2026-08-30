"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { SecureImage } from "@/components/files/secure-image";
import { PEXELS_PHOTO_MIME } from "@/components/pexels/pexels-media-browser";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import { cn } from "@/lib/utils";
import type {
  TreatmentAsset,
  TreatmentElement,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "@/lib/treatment-studio/types";

export const TREATMENT_ASSET_MIME = "application/x-treatment-asset";
export { PEXELS_PHOTO_MIME };

type TreatmentSlideCanvasProps = {
  slide: TreatmentSlide;
  assets: TreatmentAsset[];
  aspectRatio?: "16:9" | "4:3";
  readOnly?: boolean;
  className?: string;
  selectedElementId?: string | null;
  onFieldChange?: (patch: Partial<TreatmentSlide>) => void;
  onElementsChange?: (elements: TreatmentElement[]) => void;
  onSelectElement?: (elementId: string | null) => void;
  onDropAsset?: (assetId: string, xPercent: number, yPercent: number) => void;
  /** Drop a Pexels search result — parent imports then places on slide */
  onDropPexels?: (photoId: number, xPercent: number, yPercent: number) => void | Promise<void>;
  projectId?: string;
};

function assetMap(assets: TreatmentAsset[]) {
  return new Map(assets.map((a) => [a.id, a]));
}

function SlideReferences({
  referenceIds,
  assets,
  compact,
  projectId,
}: {
  referenceIds: string[];
  assets: TreatmentAsset[];
  compact?: boolean;
  projectId?: string;
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
          {ref.type === "image" || ref.type === "video" ? (
            <SecureImage
              fileRef={ref.thumbnailUrl || ref.url}
              alt={ref.title || "Reference"}
              className="aspect-video w-full object-cover"
              projectId={projectId}
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
  projectId?: string,
) {
  const change = (patch: Partial<TreatmentSlide>) => {
    if (!readOnly) onFieldChange?.(patch);
  };

  const bg = (slide.backgroundColor || "#ffffff").replace("#", "");
  const r = parseInt(bg.slice(0, 2) || "ff", 16);
  const g = parseInt(bg.slice(2, 4) || "ff", 16);
  const b = parseInt(bg.slice(4, 6) || "ff", 16);
  const darkBg = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
  const titleClass = darkBg
    ? "text-3xl font-semibold tracking-tight text-white md:text-5xl"
    : "text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl";
  const subClass = darkBg
    ? "mt-4 text-lg text-slate-300 md:text-xl"
    : "mt-4 text-lg text-slate-600 md:text-xl";
  const h2Class = darkBg
    ? "text-2xl font-semibold text-white md:text-3xl"
    : "text-2xl font-semibold text-slate-900 md:text-3xl";
  const bodyClass = darkBg
    ? "mt-6 flex-1 text-sm leading-relaxed text-slate-200 md:text-base"
    : "mt-6 flex-1 text-sm leading-relaxed text-slate-700 md:text-base";

  switch (layout) {
    case "title":
      return (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <EditableText
            value={slide.title}
            placeholder="Project Title"
            readOnly={readOnly}
            onChange={(title) => change({ title })}
            className={titleClass}
          />
          <EditableText
            value={slide.subtitle ?? ""}
            placeholder="Subtitle or byline"
            readOnly={readOnly}
            onChange={(subtitle) => change({ subtitle })}
            className={subClass}
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
            {heroRef?.type === "image" || heroRef?.type === "video" ? (
              <SecureImage
                fileRef={heroRef.thumbnailUrl || heroRef.url}
                alt={heroRef.title || "Reference"}
                className="max-h-full w-full rounded-lg object-cover shadow-md"
                projectId={projectId}
              />
            ) : (
              <SlideReferences
                referenceIds={slide.referenceIds.slice(0, 1)}
                assets={assets}
                compact
                projectId={projectId}
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
          {heroRef?.type === "image" || heroRef?.type === "video" ? (
            <SecureImage
              fileRef={heroRef.thumbnailUrl || heroRef.url}
              alt={heroRef.title || "Reference"}
              className="h-full w-full object-cover"
              projectId={projectId}
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
          <SlideReferences
            referenceIds={slide.referenceIds}
            assets={assets}
            projectId={projectId}
          />
        </div>
      );
    case "blank":
      return (
        <div className="pointer-events-none flex h-full items-center justify-center p-8 text-sm text-slate-400">
          {readOnly ? null : "Blank canvas — drop references or add text"}
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
            className={h2Class}
          />
          <EditableText
            value={slide.body ?? ""}
            placeholder="Write your treatment copy..."
            multiline
            readOnly={readOnly}
            onChange={(body) => change({ body })}
            className={bodyClass}
          />
        </div>
      );
  }
}

type DragMode = "move" | "resize-se" | "resize-e" | "resize-s";

function FreeformElement({
  element,
  asset,
  selected,
  readOnly,
  projectId,
  onSelect,
  onChange,
  onDelete,
}: {
  element: TreatmentElement;
  asset?: TreatmentAsset;
  selected: boolean;
  readOnly: boolean;
  projectId?: string;
  onSelect: () => void;
  onChange: (patch: Partial<TreatmentElement>) => void;
  onDelete: () => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const [livePos, setLivePos] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    parentW: number;
    parentH: number;
    pointerId: number;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const display = livePos ?? {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };

  const beginDrag = (e: React.PointerEvent, mode: DragMode) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const parent = (e.currentTarget as HTMLElement).closest(
      "[data-treatment-canvas]",
    ) as HTMLElement | null;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
      origW: element.width,
      origH: element.height,
      parentW: rect.width,
      parentH: rect.height,
      pointerId: e.pointerId,
    };
    setLivePos({
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
      const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
      let next = {
        x: drag.origX,
        y: drag.origY,
        width: drag.origW,
        height: drag.origH,
      };
      if (drag.mode === "move") {
        next = {
          ...next,
          x: Math.min(95, Math.max(-5, drag.origX + dx)),
          y: Math.min(95, Math.max(-5, drag.origY + dy)),
        };
      } else if (drag.mode === "resize-se") {
        next = {
          ...next,
          width: Math.min(100, Math.max(8, drag.origW + dx)),
          height: Math.min(100, Math.max(6, drag.origH + dy)),
        };
      } else if (drag.mode === "resize-e") {
        next = { ...next, width: Math.min(100, Math.max(8, drag.origW + dx)) };
      } else if (drag.mode === "resize-s") {
        next = { ...next, height: Math.min(100, Math.max(6, drag.origH + dy)) };
      }
      setLivePos(next);
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setLivePos((pos) => {
        if (pos) onChangeRef.current(pos);
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    if (readOnly || !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (editingText) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, selected, editingText, onDelete]);

  return (
    <div
      className={cn(
        "absolute touch-none",
        readOnly ? "pointer-events-none" : "cursor-move",
        selected && !readOnly && "ring-2 ring-orange-400 ring-offset-1",
      )}
      style={{
        left: `${display.x}%`,
        top: `${display.y}%`,
        width: `${display.width}%`,
        height: `${display.height}%`,
        zIndex: readOnly
          ? element.zIndex || 1
          : (element.zIndex || 1) + (selected ? 1000 : 0),
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      }}
      onPointerDown={(e) => {
        if (readOnly) return;
        beginDrag(e, "move");
      }}
      onClick={(e) => {
        if (readOnly) return;
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        if (element.type === "text" && !readOnly) {
          e.stopPropagation();
          setEditingText(true);
        }
      }}
    >
      {element.type === "text" ? (
        editingText && !readOnly ? (
          <textarea
            autoFocus
            value={element.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onBlur={() => setEditingText(false)}
            className="h-full w-full resize-none border-0 bg-transparent p-1 outline-none"
            style={{
              fontSize: element.fontSize ?? 24,
              fontWeight: element.fontWeight ?? "600",
              color: element.color ?? "#0f172a",
              textAlign: element.align ?? "left",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="h-full w-full overflow-hidden p-1 whitespace-pre-wrap"
            style={{
              fontSize: element.fontSize ?? 24,
              fontWeight: element.fontWeight ?? "600",
              color: element.color ?? "#0f172a",
              textAlign: element.align ?? "left",
              lineHeight: 1.25,
            }}
          >
            {element.text || "Text"}
          </div>
        )
      ) : null}

      {element.type === "image" ? (
        asset?.type === "video" ? (
          <video
            src={
              resolveRenderableFileSource(asset.url, { projectId }) ?? undefined
            }
            poster={
              resolveRenderableFileSource(asset.thumbnailUrl, { projectId }) ??
              undefined
            }
            className="pointer-events-none h-full w-full rounded-sm object-cover"
            muted
            playsInline
          />
        ) : asset?.type === "link" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm bg-slate-100 p-2 text-center">
            <span className="text-[10px] font-medium text-slate-500">Link</span>
            <span className="line-clamp-3 text-xs text-slate-700">
              {asset.title || asset.url}
            </span>
          </div>
        ) : asset ? (
          <SecureImage
            fileRef={asset.thumbnailUrl || asset.url}
            alt={asset.title || "Reference"}
            className="pointer-events-none h-full w-full rounded-sm object-cover"
            projectId={projectId}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-sm bg-slate-200 text-xs text-slate-500">
            Missing asset
          </div>
        )
      ) : null}

      {element.type === "shape" ? (
        <div
          className="h-full w-full"
          style={{
            backgroundColor: element.fill ?? "#fb923c",
            border:
              element.stroke && element.stroke !== "transparent"
                ? `2px solid ${element.stroke}`
                : undefined,
            borderRadius: element.shape === "ellipse" ? "50%" : "4px",
          }}
        />
      ) : null}

      {selected && !readOnly ? (
        <>
          <button
            type="button"
            className="absolute -right-2 -top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-sm leading-none text-white shadow-md hover:bg-red-600"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            aria-label="Delete element"
          >
            ×
          </button>
          <div
            className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm bg-orange-400 shadow"
            onPointerDown={(e) => beginDrag(e, "resize-se")}
          />
          <div
            className="absolute right-0 top-1/2 z-20 h-3.5 w-2.5 -translate-y-1/2 translate-x-1/2 cursor-e-resize rounded-sm bg-orange-400 shadow"
            onPointerDown={(e) => beginDrag(e, "resize-e")}
          />
          <div
            className="absolute bottom-0 left-1/2 z-20 h-2.5 w-3.5 -translate-x-1/2 translate-y-1/2 cursor-s-resize rounded-sm bg-orange-400 shadow"
            onPointerDown={(e) => beginDrag(e, "resize-s")}
          />
        </>
      ) : null}
    </div>
  );
}

export function TreatmentSlideCanvas({
  slide,
  assets,
  aspectRatio = "16:9",
  readOnly = false,
  className,
  selectedElementId,
  onFieldChange,
  onElementsChange,
  onSelectElement,
  onDropAsset,
  onDropPexels,
  projectId,
}: TreatmentSlideCanvasProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pexelsDropBusy, setPexelsDropBusy] = useState(false);
  const map = assetMap(assets);

  const updateElement = useCallback(
    (id: string, patch: Partial<TreatmentElement>) => {
      const next = slide.elements.map((el) =>
        el.id === id ? { ...el, ...patch } : el,
      );
      onElementsChange?.(next);
    },
    [slide.elements, onElementsChange],
  );

  const deleteElement = useCallback(
    (id: string) => {
      onElementsChange?.(slide.elements.filter((el) => el.id !== id));
      onSelectElement?.(null);
    },
    [slide.elements, onElementsChange, onSelectElement],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (readOnly) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const xPercent = Math.min(70, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100 - 15));
    const yPercent = Math.min(70, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100 - 15));

    const pexelsRaw = e.dataTransfer.getData(PEXELS_PHOTO_MIME);
    if (pexelsRaw && onDropPexels) {
      try {
        const parsed = JSON.parse(pexelsRaw) as { id?: number };
        if (parsed.id) {
          setPexelsDropBusy(true);
          void Promise.resolve(onDropPexels(parsed.id, xPercent, yPercent)).finally(() =>
            setPexelsDropBusy(false),
          );
          return;
        }
      } catch {
        /* fall through to asset drop */
      }
    }

    if (!onDropAsset) return;
    const assetId =
      e.dataTransfer.getData(TREATMENT_ASSET_MIME) ||
      e.dataTransfer.getData("text/plain");
    if (!assetId || !assets.some((a) => a.id === assetId)) return;
    onDropAsset(assetId, xPercent, yPercent);
  };

  return (
    <div
      data-treatment-canvas
      className={cn(
        "treatment-slide-canvas relative overflow-hidden rounded-sm bg-white text-slate-900",
        aspectRatio === "16:9" ? "aspect-video" : "aspect-[4/3]",
        dragOver && "ring-2 ring-orange-400",
        className,
      )}
      style={{ backgroundColor: slide.backgroundColor ?? "#ffffff" }}
      onClick={() => onSelectElement?.(null)}
      onDragOver={(e) => {
        if (readOnly) return;
        if (
          e.dataTransfer.types.includes(TREATMENT_ASSET_MIME) ||
          e.dataTransfer.types.includes(PEXELS_PHOTO_MIME) ||
          e.dataTransfer.types.includes("text/plain")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {pexelsDropBusy ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
          Adding from Pexels…
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 [&_*]:pointer-events-auto">
        {layoutContent(
          slide.layout,
          slide,
          assets,
          readOnly,
          onFieldChange,
          projectId,
        )}
      </div>

      {slide.elements.map((el) => (
        <FreeformElement
          key={el.id}
          element={el}
          asset={el.referenceId ? map.get(el.referenceId) : undefined}
          selected={selectedElementId === el.id}
          readOnly={readOnly}
          projectId={projectId}
          onSelect={() => onSelectElement?.(el.id)}
          onChange={(patch) => updateElement(el.id, patch)}
          onDelete={() => deleteElement(el.id)}
        />
      ))}

      {dragOver && !readOnly ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-orange-500/10">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">
            Drop to place on slide
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Mini thumbnail for slide navigator — supports hold/drag reorder via parent DnD props */
export function TreatmentSlideThumbnail({
  slide,
  assets,
  index,
  active,
  onClick,
  projectId,
  draggable = false,
  dragging = false,
  dropBefore = false,
  dropAfter = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  slide: TreatmentSlide;
  assets: TreatmentAsset[];
  index: number;
  active: boolean;
  onClick: () => void;
  projectId?: string;
  draggable?: boolean;
  dragging?: boolean;
  dropBefore?: boolean;
  dropAfter?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={cn("relative", dragging && "opacity-40")}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dropBefore ? (
        <div
          className="pointer-events-none absolute inset-x-1 -top-1 z-20 h-0.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        draggable={draggable}
        onDragStart={(e) => {
          // Keep click from firing after a successful drag reorder.
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", slide.id);
          onDragStart?.(e);
        }}
        onDragEnd={onDragEnd}
        onClick={onClick}
        aria-grabbed={dragging || undefined}
        title="Hold and drag to reorder"
        className={cn(
          "treatment-slide-thumb group relative w-full cursor-grab overflow-hidden rounded-md border transition active:cursor-grabbing",
          active
            ? "border-orange-400/60 ring-1 ring-orange-400/30"
            : "border-white/10 hover:border-white/25",
          dragging && "cursor-grabbing ring-1 ring-orange-400/50",
        )}
      >
        <div className="pointer-events-none scale-[0.22] origin-top-left w-[454%]">
          <TreatmentSlideCanvas
            slide={slide}
            assets={assets}
            readOnly
            projectId={projectId}
          />
        </div>
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {index + 1}
        </span>
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/50 text-slate-300 opacity-70 transition group-hover:opacity-100">
          <GripVertical className="h-3 w-3" aria-hidden />
        </span>
      </button>
      {dropAfter ? (
        <div
          className="pointer-events-none absolute inset-x-1 -bottom-1 z-20 h-0.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
