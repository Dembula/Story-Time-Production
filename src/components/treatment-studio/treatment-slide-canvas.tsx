"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { SecureImage } from "@/components/files/secure-image";
import { PEXELS_PHOTO_MIME } from "@/components/pexels/pexels-media-browser";
import {
  fieldsForLayout,
  resolveFieldFrame,
} from "@/lib/treatment-studio/field-frames";
import type {
  TreatmentAsset,
  TreatmentElement,
  TreatmentFieldFrame,
  TreatmentFieldKey,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "@/lib/treatment-studio/types";
import { cn } from "@/lib/utils";
import { TreatmentVideoStill } from "./treatment-video-still";

export const TREATMENT_ASSET_MIME = "application/x-treatment-asset";
export { PEXELS_PHOTO_MIME };

type TreatmentSlideCanvasProps = {
  slide: TreatmentSlide;
  assets: TreatmentAsset[];
  aspectRatio?: "16:9" | "4:3";
  readOnly?: boolean;
  /** Presentation mode — clips can play when clipPlaying is true */
  presentMode?: boolean;
  /** When true in presentMode, play video clips on this slide */
  clipPlaying?: boolean;
  className?: string;
  selectedElementId?: string | null;
  selectedFieldKey?: TreatmentFieldKey | null;
  onFieldChange?: (patch: Partial<TreatmentSlide>) => void;
  onElementsChange?: (elements: TreatmentElement[]) => void;
  onSelectElement?: (elementId: string | null) => void;
  onSelectField?: (key: TreatmentFieldKey | null) => void;
  onDropAsset?: (assetId: string, xPercent: number, yPercent: number) => void;
  /** Drop a Pexels search result — parent imports then places on slide */
  onDropPexels?: (photoId: number, xPercent: number, yPercent: number) => void | Promise<void>;
  projectId?: string;
};

function assetMap(assets: TreatmentAsset[]) {
  return new Map(assets.map((a) => [a.id, a]));
}

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragMode = "move" | `resize-${ResizeHandle}`;

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};

function applyResize(
  mode: DragMode,
  orig: TreatmentFieldFrame,
  dx: number,
  dy: number,
): TreatmentFieldFrame {
  let { x, y, width, height } = orig;
  const minW = 8;
  const minH = 6;

  if (mode === "move") {
    return {
      x: Math.min(95, Math.max(-5, x + dx)),
      y: Math.min(95, Math.max(-5, y + dy)),
      width,
      height,
    };
  }

  const handle = mode.replace("resize-", "") as ResizeHandle;
  if (handle.includes("e")) width = Math.min(100 - x, Math.max(minW, width + dx));
  if (handle.includes("s")) height = Math.min(100 - y, Math.max(minH, height + dy));
  if (handle.includes("w")) {
    const nextW = Math.min(width + x, Math.max(minW, width - dx));
    const delta = width - nextW;
    x = Math.min(95, Math.max(-5, x + delta));
    width = nextW;
  }
  if (handle.includes("n")) {
    const nextH = Math.min(height + y, Math.max(minH, height - dy));
    const delta = height - nextH;
    y = Math.min(95, Math.max(-5, y + delta));
    height = nextH;
  }
  return { x, y, width, height };
}

function SelectionChrome({
  onBeginResize,
  onDelete,
  showDelete,
}: {
  onBeginResize: (e: React.PointerEvent, handle: ResizeHandle) => void;
  onDelete?: () => void;
  showDelete?: boolean;
}) {
  const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const pos: Record<ResizeHandle, string> = {
    nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
    s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  };

  return (
    <>
      <div className="treatment-selection-outline pointer-events-none absolute inset-0" />
      {handles.map((h) => (
        <div
          key={h}
          className={cn("treatment-resize-handle absolute z-20", pos[h])}
          style={{ cursor: HANDLE_CURSOR[h] }}
          onPointerDown={(e) => onBeginResize(e, h)}
        />
      ))}
      {showDelete && onDelete ? (
        <button
          type="button"
          className="treatment-element-delete absolute -right-2.5 -top-2.5 z-30"
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
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      ) : null}
    </>
  );
}

function useFrameDrag(
  readOnly: boolean,
  frame: TreatmentFieldFrame,
  onCommit: (next: TreatmentFieldFrame) => void,
  onSelect: () => void,
) {
  const [livePos, setLivePos] = useState<TreatmentFieldFrame | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    orig: TreatmentFieldFrame;
    parentW: number;
    parentH: number;
    pointerId: number;
  } | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const display = livePos ?? frame;

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
      orig: { ...frame },
      parentW: rect.width,
      parentH: rect.height,
      pointerId: e.pointerId,
    };
    setLivePos({ ...frame });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = ((e.clientX - drag.startX) / drag.parentW) * 100;
      const dy = ((e.clientY - drag.startY) / drag.parentH) * 100;
      setLivePos(applyResize(drag.mode, drag.orig, dx, dy));
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setLivePos((pos) => {
        if (pos) onCommitRef.current(pos);
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

  return { display, beginDrag };
}

function SlideReferences({
  referenceIds,
  assets,
  compact,
  projectId,
  presentMode,
  clipPlaying,
}: {
  referenceIds: string[];
  assets: TreatmentAsset[];
  compact?: boolean;
  projectId?: string;
  presentMode?: boolean;
  clipPlaying?: boolean;
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
          {ref.type === "video" ? (
            <TreatmentVideoStill
              url={ref.url}
              thumbnailUrl={ref.thumbnailUrl}
              projectId={projectId}
              alt={ref.title || "Clip"}
              className="aspect-video w-full"
              allowPlayback={Boolean(presentMode)}
              playing={Boolean(presentMode && clipPlaying)}
            />
          ) : ref.type === "image" ? (
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
  const ref = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    const next = value ?? "";
    if (el.innerText !== next) {
      el.innerText = next;
    }
  }, [value, readOnly]);

  const empty = !(value ?? "").trim();

  return (
    <div
      ref={ref}
      role={readOnly ? undefined : "textbox"}
      tabIndex={readOnly ? undefined : 0}
      contentEditable={readOnly ? false : true}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "treatment-slide-text outline-none",
        multiline && "whitespace-pre-wrap",
        className,
        !readOnly &&
          "cursor-text rounded-sm focus-visible:ring-1 focus-visible:ring-orange-400/40",
        empty && "treatment-slide-text--empty",
      )}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        if (readOnly) return;
        const raw = e.currentTarget.innerText ?? "";
        const next = multiline
          ? raw.replace(/\n$/, "")
          : raw.replace(/\s*\n\s*/g, " ").trim();
        if (next !== (value ?? "")) onChange?.(next);
      }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).blur();
        }
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        // Allow parent move/resize when not actively editing the text.
        if (!readOnly && focusedRef.current) e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function MovableField({
  fieldKey,
  frame,
  value,
  placeholder,
  className,
  multiline,
  selected,
  readOnly,
  onSelect,
  onTextChange,
  onFrameChange,
}: {
  fieldKey: TreatmentFieldKey;
  frame: TreatmentFieldFrame;
  value: string;
  placeholder: string;
  className?: string;
  multiline?: boolean;
  selected: boolean;
  readOnly: boolean;
  onSelect: () => void;
  onTextChange: (value: string) => void;
  onFrameChange: (frame: TreatmentFieldFrame) => void;
}) {
  const { display, beginDrag } = useFrameDrag(
    readOnly,
    frame,
    onFrameChange,
    onSelect,
  );

  return (
    <div
      data-field-key={fieldKey}
      className={cn(
        "absolute touch-none",
        readOnly ? "pointer-events-none" : "cursor-move",
        selected && !readOnly && "z-[1100]",
      )}
      style={{
        left: `${display.x}%`,
        top: `${display.y}%`,
        width: `${display.width}%`,
        height: `${display.height}%`,
        zIndex: readOnly ? 2 : selected ? 1100 : 5,
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
    >
      <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden">
        <EditableText
          value={value}
          placeholder={placeholder}
          multiline={multiline}
          readOnly={readOnly}
          onChange={onTextChange}
          className={cn(className, "h-full")}
        />
      </div>
      {selected && !readOnly ? (
        <SelectionChrome
          onBeginResize={(e, h) => beginDrag(e, `resize-${h}`)}
          showDelete={false}
        />
      ) : null}
    </div>
  );
}

function layoutMedia(
  layout: TreatmentSlideLayout,
  slide: TreatmentSlide,
  assets: TreatmentAsset[],
  readOnly: boolean,
  projectId?: string,
  presentMode?: boolean,
  clipPlaying?: boolean,
) {
  const map = assetMap(assets);
  const bg = (slide.backgroundColor || "#ffffff").replace("#", "");
  const r = parseInt(bg.slice(0, 2) || "ff", 16);
  const g = parseInt(bg.slice(2, 4) || "ff", 16);
  const b = parseInt(bg.slice(4, 6) || "ff", 16);
  const darkBg = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;

  switch (layout) {
    case "split": {
      const heroRef = slide.referenceIds[0]
        ? map.get(slide.referenceIds[0])
        : undefined;
      return (
        <div className="pointer-events-none absolute inset-y-[5%] right-[5%] left-[52%]">
          {heroRef?.type === "video" ? (
            <TreatmentVideoStill
              url={heroRef.url}
              thumbnailUrl={heroRef.thumbnailUrl}
              projectId={projectId}
              alt={heroRef.title || "Clip"}
              className="h-full w-full rounded-lg shadow-md"
              allowPlayback={Boolean(presentMode)}
              playing={Boolean(presentMode && clipPlaying)}
              showPlayHint={Boolean(presentMode && !clipPlaying)}
            />
          ) : heroRef?.type === "image" ? (
            <SecureImage
              fileRef={heroRef.thumbnailUrl || heroRef.url}
              alt={heroRef.title || "Reference"}
              className="h-full w-full rounded-lg object-cover shadow-md"
              projectId={projectId}
            />
          ) : (
            <div
              className={cn(
                "flex h-full min-h-[140px] w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center",
                darkBg ? "border-white/20 bg-black/10" : "border-slate-300/80 bg-slate-50",
              )}
            >
              <p className={cn("text-sm", darkBg ? "text-white/60" : "text-slate-500")}>
                No hero image
              </p>
              <p className={cn("mt-1 text-[11px]", darkBg ? "text-white/40" : "text-slate-400")}>
                {readOnly
                  ? "Add a reference in the editor."
                  : "Click a still in Assets to fill this panel."}
              </p>
            </div>
          )}
        </div>
      );
    }
    case "image": {
      const heroRef = slide.referenceIds[0]
        ? map.get(slide.referenceIds[0])
        : undefined;
      return (
        <div className="pointer-events-none absolute inset-0">
          {heroRef?.type === "video" ? (
            <TreatmentVideoStill
              url={heroRef.url}
              thumbnailUrl={heroRef.thumbnailUrl}
              projectId={projectId}
              alt={heroRef.title || "Clip"}
              className="h-full w-full"
              allowPlayback={Boolean(presentMode)}
              playing={Boolean(presentMode && clipPlaying)}
              showPlayHint={Boolean(presentMode && !clipPlaying)}
            />
          ) : heroRef?.type === "image" ? (
            <SecureImage
              fileRef={heroRef.thumbnailUrl || heroRef.url}
              alt={heroRef.title || "Reference"}
              className="h-full w-full object-cover"
              projectId={projectId}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-100 px-6 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-500">No full-bleed image yet</p>
              <p className="max-w-xs text-xs leading-relaxed">
                {readOnly
                  ? "This slide has no reference image."
                  : "Open Assets and click a still — it fills this layout."}
              </p>
            </div>
          )}
          {(slide.title || !readOnly) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/70 to-transparent" />
          )}
        </div>
      );
    }
    case "references":
      return (
        <div className="pointer-events-none absolute inset-x-[5%] bottom-[5%] top-[16%]">
          <SlideReferences
            referenceIds={slide.referenceIds}
            assets={assets}
            projectId={projectId}
            presentMode={presentMode}
            clipPlaying={clipPlaying}
          />
        </div>
      );
    case "blank":
      return readOnly ? null : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-[5%] text-sm text-slate-400">
          Blank canvas — drop references or add text
        </div>
      );
    default:
      return null;
  }
}

function FreeformElement({
  element,
  asset,
  selected,
  readOnly,
  presentMode,
  clipPlaying,
  projectId,
  onSelect,
  onChange,
  onDelete,
}: {
  element: TreatmentElement;
  asset?: TreatmentAsset;
  selected: boolean;
  readOnly: boolean;
  presentMode?: boolean;
  clipPlaying?: boolean;
  projectId?: string;
  onSelect: () => void;
  onChange: (patch: Partial<TreatmentElement>) => void;
  onDelete: () => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const frame: TreatmentFieldFrame = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
  const { display, beginDrag } = useFrameDrag(
    readOnly,
    frame,
    (next) => onChange(next),
    onSelect,
  );

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

  const interactivePresent = Boolean(presentMode);

  return (
    <div
      className={cn(
        "absolute touch-none",
        readOnly && !interactivePresent ? "pointer-events-none" : null,
        !readOnly && "cursor-move",
        selected && !readOnly && "z-[1200]",
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
          <TreatmentVideoStill
            url={asset.url}
            thumbnailUrl={asset.thumbnailUrl}
            projectId={projectId}
            alt={asset.title || "Clip"}
            className="h-full w-full rounded-sm"
            allowPlayback={Boolean(presentMode)}
            playing={Boolean(presentMode && clipPlaying)}
            showPlayHint={Boolean(presentMode && !clipPlaying)}
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
        <SelectionChrome
          onBeginResize={(e, h) => beginDrag(e, `resize-${h}`)}
          onDelete={onDelete}
          showDelete
        />
      ) : null}
    </div>
  );
}

function LayoutTextFields({
  slide,
  readOnly,
  selectedFieldKey,
  onFieldChange,
  onSelectField,
}: {
  slide: TreatmentSlide;
  readOnly: boolean;
  selectedFieldKey?: TreatmentFieldKey | null;
  onFieldChange?: (patch: Partial<TreatmentSlide>) => void;
  onSelectField?: (key: TreatmentFieldKey | null) => void;
}) {
  const bg = (slide.backgroundColor || "#ffffff").replace("#", "");
  const r = parseInt(bg.slice(0, 2) || "ff", 16);
  const g = parseInt(bg.slice(2, 4) || "ff", 16);
  const b = parseInt(bg.slice(4, 6) || "ff", 16);
  const darkBg = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;

  const titleClass =
    slide.layout === "title"
      ? cn("treatment-type-title w-full text-center", darkBg ? "text-white" : "text-slate-900")
      : slide.layout === "image"
        ? "treatment-type-caption w-full text-white"
        : cn("treatment-type-heading w-full", darkBg ? "text-white" : "text-slate-900");
  const subClass = cn(
    "treatment-type-subtitle w-full text-center",
    darkBg ? "text-white/75" : "text-slate-600",
  );
  const bodyClass = cn(
    "treatment-type-body w-full",
    darkBg ? "text-white/80" : "text-slate-700",
  );

  const keys = fieldsForLayout(slide.layout);
  if (keys.length === 0) return null;

  const updateFrame = (key: TreatmentFieldKey, frame: TreatmentFieldFrame) => {
    onFieldChange?.({
      fieldFrames: {
        ...(slide.fieldFrames ?? {}),
        [key]: frame,
      },
    });
  };

  return (
    <>
      {keys.map((key) => {
        const frame = resolveFieldFrame(slide, key);
        if (!frame) return null;
        const value =
          key === "title"
            ? slide.title
            : key === "subtitle"
              ? slide.subtitle ?? ""
              : slide.body ?? "";
        const placeholder =
          key === "title"
            ? slide.layout === "title"
              ? "Project Title"
              : slide.layout === "image"
                ? "Caption"
                : slide.layout === "references"
                  ? "References"
                  : "Slide title"
            : key === "subtitle"
              ? "Subtitle or byline"
              : "Write your treatment copy...";
        const className =
          key === "title" ? titleClass : key === "subtitle" ? subClass : bodyClass;

        return (
          <MovableField
            key={key}
            fieldKey={key}
            frame={frame}
            value={value}
            placeholder={placeholder}
            multiline={key === "body"}
            className={className}
            selected={selectedFieldKey === key}
            readOnly={readOnly}
            onSelect={() => {
              onSelectField?.(key);
            }}
            onTextChange={(next) => {
              if (key === "title") onFieldChange?.({ title: next });
              else if (key === "subtitle") onFieldChange?.({ subtitle: next });
              else onFieldChange?.({ body: next });
            }}
            onFrameChange={(next) => updateFrame(key, next)}
          />
        );
      })}
    </>
  );
}

export function TreatmentSlideCanvas({
  slide,
  assets,
  aspectRatio = "16:9",
  readOnly = false,
  presentMode = false,
  clipPlaying = false,
  className,
  selectedElementId,
  selectedFieldKey,
  onFieldChange,
  onElementsChange,
  onSelectElement,
  onSelectField,
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
      onClick={() => {
        onSelectElement?.(null);
        onSelectField?.(null);
      }}
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

      {layoutMedia(
        slide.layout,
        slide,
        assets,
        readOnly,
        projectId,
        presentMode,
        clipPlaying,
      )}

      <LayoutTextFields
        slide={slide}
        readOnly={readOnly}
        selectedFieldKey={selectedFieldKey}
        onFieldChange={onFieldChange}
        onSelectField={(key) => {
          onSelectElement?.(null);
          onSelectField?.(key);
        }}
      />

      {slide.elements.map((el) => (
        <FreeformElement
          key={el.id}
          element={el}
          asset={el.referenceId ? map.get(el.referenceId) : undefined}
          selected={selectedElementId === el.id}
          readOnly={readOnly}
          presentMode={presentMode}
          clipPlaying={clipPlaying}
          projectId={projectId}
          onSelect={() => {
            onSelectField?.(null);
            onSelectElement?.(el.id);
          }}
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
