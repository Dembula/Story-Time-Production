"use client";

import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Lock,
  Unlock,
} from "lucide-react";
import type {
  TreatmentElement,
  TreatmentFieldKey,
  TreatmentFieldStyle,
  TreatmentSlide,
} from "@/lib/treatment-studio/types";
import { cn } from "@/lib/utils";

const FONT_OPTIONS = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "ui-monospace, SFMono-Regular, Menlo, monospace", label: "Mono" },
  { value: "'Playfair Display', Georgia, serif", label: "Playfair" },
];

const TEXT_PRESETS = [
  { label: "Aa", color: "#0f172a", bg: "#ffffff" },
  { label: "Aa", color: "#ffffff", bg: "#0f172a" },
  { label: "Aa", color: "#fb923c", bg: "#0f172a" },
  { label: "Aa", color: "#38bdf8", bg: "#0f172a" },
  { label: "Aa", color: "#fef3c7", bg: "#7c2d12" },
  { label: "Aa", color: "#14532d", bg: "#ecfccb" },
];

type InspectorTab = "style" | "text" | "arrange";

type TreatmentFormatInspectorProps = {
  slide: TreatmentSlide;
  selectedElement: TreatmentElement | null;
  selectedFieldKey: TreatmentFieldKey | null;
  onUpdateElement: (patch: Partial<TreatmentElement>) => void;
  onUpdateFieldStyle: (key: TreatmentFieldKey, patch: TreatmentFieldStyle) => void;
  onUpdateSlide: (patch: Partial<TreatmentSlide>) => void;
  onBringFront: () => void;
  onSendBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/8 px-3 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export function TreatmentFormatInspector({
  slide,
  selectedElement,
  selectedFieldKey,
  onUpdateElement,
  onUpdateFieldStyle,
  onUpdateSlide,
  onBringFront,
  onSendBack,
  onDuplicate,
  onDelete,
  onToggleLock,
}: TreatmentFormatInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("style");
  const fieldStyle = selectedFieldKey
    ? slide.fieldStyles?.[selectedFieldKey] ?? {}
    : null;
  const hasSelection = Boolean(selectedElement || selectedFieldKey);
  const isText =
    selectedElement?.type === "text" || Boolean(selectedFieldKey);
  const isMedia = selectedElement?.type === "image";
  const isShape = selectedElement?.type === "shape";

  if (!hasSelection) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#111113] text-slate-200">
        <div className="border-b border-white/10 px-3 py-2.5">
          <p className="text-xs font-medium text-white">Format</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Slide</p>
        </div>
        <Section title="Background">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={slide.backgroundColor || "#ffffff"}
              onChange={(e) => onUpdateSlide({ backgroundColor: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
            />
            <span className="text-xs text-slate-400">
              {slide.backgroundColor || "#ffffff"}
            </span>
          </div>
        </Section>
        <Section title="Appearance">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Select a text box, image, video, or shape to edit Style, Text, and Arrange —
            like Keynote’s Format inspector.
          </p>
        </Section>
      </aside>
    );
  }

  const textColor =
    selectedElement?.color ?? fieldStyle?.color ?? "#0f172a";
  const fontSize =
    selectedElement?.fontSize ?? fieldStyle?.fontSize ?? (selectedFieldKey === "title" ? 42 : 18);
  const fontWeight =
    selectedElement?.fontWeight ?? fieldStyle?.fontWeight ?? "600";
  const fontFamily =
    selectedElement?.fontFamily ?? fieldStyle?.fontFamily ?? FONT_OPTIONS[0].value;
  const align =
    selectedElement?.align ?? fieldStyle?.align ?? "left";
  const opacity =
    selectedElement?.opacity ?? fieldStyle?.opacity ?? 1;

  const setTextProp = <K extends keyof TreatmentFieldStyle>(
    key: K,
    value: TreatmentFieldStyle[K],
  ) => {
    if (selectedElement) {
      onUpdateElement({ [key]: value } as Partial<TreatmentElement>);
    } else if (selectedFieldKey) {
      onUpdateFieldStyle(selectedFieldKey, { [key]: value });
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-white/10 bg-[#111113] text-slate-200">
      <div className="border-b border-white/10 px-3 py-2">
        <p className="text-xs font-medium text-white">Format</p>
        <p className="mt-0.5 text-[10px] capitalize text-slate-500">
          {selectedElement
            ? selectedElement.type === "image"
              ? "Media"
              : selectedElement.type
            : selectedFieldKey
              ? `${selectedFieldKey} field`
              : "Object"}
          {selectedElement?.locked ? " · Locked" : ""}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-black/40 p-0.5">
          {(["style", "text", "arrange"] as const).map((id) => (
            <button
              key={id}
              type="button"
              disabled={id === "text" && !isText && !isShape}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[10px] font-medium capitalize transition",
                tab === id
                  ? "bg-white/12 text-white"
                  : "text-slate-500 hover:text-slate-300 disabled:opacity-30",
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "style" ? (
          <>
            {isText ? (
              <Section title="Text styles">
                <div className="grid grid-cols-3 gap-1.5">
                  {TEXT_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      className="flex h-10 items-center justify-center rounded-md border border-white/10 text-sm font-semibold"
                      style={{ backgroundColor: preset.bg, color: preset.color }}
                      onClick={() => setTextProp("color", preset.color)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            {isShape ? (
              <Section title="Fill">
                <input
                  type="color"
                  value={selectedElement?.fill ?? "#fb923c"}
                  onChange={(e) => onUpdateElement({ fill: e.target.value })}
                  className="h-8 w-full cursor-pointer rounded border-0 bg-transparent"
                />
              </Section>
            ) : null}

            {isMedia || isShape || isText ? (
              <Section title="Shadow">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement?.shadow)}
                    disabled={!selectedElement}
                    onChange={(e) => onUpdateElement({ shadow: e.target.checked })}
                    className="rounded border-white/20"
                  />
                  Drop shadow
                </label>
              </Section>
            ) : null}

            <Section title="Opacity">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => {
                    const next = Number(e.target.value) / 100;
                    if (selectedElement) onUpdateElement({ opacity: next });
                    else if (selectedFieldKey) {
                      onUpdateFieldStyle(selectedFieldKey, { opacity: next });
                    }
                  }}
                  className="flex-1 accent-orange-400"
                />
                <span className="w-8 text-right text-[11px] text-slate-400">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
            </Section>

            {isMedia ? (
              <Section title="Fit">
                <select
                  value={selectedElement?.objectFit ?? "cover"}
                  onChange={(e) =>
                    onUpdateElement({
                      objectFit: e.target.value as "cover" | "contain",
                    })
                  }
                  className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white"
                >
                  <option value="cover">Fill (crop)</option>
                  <option value="contain">Fit (letterbox)</option>
                </select>
              </Section>
            ) : null}
          </>
        ) : null}

        {tab === "text" && isText ? (
          <>
            <Section title="Font">
              <select
                value={fontFamily}
                onChange={(e) => setTextProp("fontFamily", e.target.value)}
                className="mb-2 h-8 w-full rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={fontWeight}
                  onChange={(e) => setTextProp("fontWeight", e.target.value)}
                  className="h-8 flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white"
                >
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extra Bold</option>
                </select>
                <input
                  type="number"
                  min={10}
                  max={160}
                  value={fontSize}
                  onChange={(e) =>
                    setTextProp("fontSize", Number(e.target.value) || 18)
                  }
                  className="h-8 w-16 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-white"
                />
              </div>
            </Section>
            <Section title="Color">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextProp("color", e.target.value)}
                className="h-8 w-full cursor-pointer rounded border-0 bg-transparent"
              />
            </Section>
            <Section title="Alignment">
              <div className="flex gap-1">
                {(
                  [
                    ["left", AlignLeft],
                    ["center", AlignCenter],
                    ["right", AlignRight],
                  ] as const
                ).map(([value, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTextProp("align", value)}
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center rounded-md border border-white/10",
                      align === value
                        ? "bg-orange-500/20 text-orange-200"
                        : "text-slate-400 hover:bg-white/5",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === "arrange" ? (
          <>
            {selectedElement ? (
              <>
                <Section title="Order">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onBringFront}
                      className="rounded-md border border-white/10 px-2 py-2 text-[11px] text-slate-300 hover:bg-white/5"
                    >
                      Bring to Front
                    </button>
                    <button
                      type="button"
                      onClick={onSendBack}
                      className="rounded-md border border-white/10 px-2 py-2 text-[11px] text-slate-300 hover:bg-white/5"
                    >
                      Send to Back
                    </button>
                  </div>
                </Section>
                <Section title="Size & position">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <label className="space-y-1">
                      <span>X %</span>
                      <input
                        type="number"
                        value={Math.round(selectedElement.x)}
                        onChange={(e) =>
                          onUpdateElement({ x: Number(e.target.value) || 0 })
                        }
                        className="h-7 w-full rounded border border-white/10 bg-black/40 px-1.5 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Y %</span>
                      <input
                        type="number"
                        value={Math.round(selectedElement.y)}
                        onChange={(e) =>
                          onUpdateElement({ y: Number(e.target.value) || 0 })
                        }
                        className="h-7 w-full rounded border border-white/10 bg-black/40 px-1.5 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>W %</span>
                      <input
                        type="number"
                        value={Math.round(selectedElement.width)}
                        onChange={(e) =>
                          onUpdateElement({
                            width: Math.max(4, Number(e.target.value) || 4),
                          })
                        }
                        className="h-7 w-full rounded border border-white/10 bg-black/40 px-1.5 text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>H %</span>
                      <input
                        type="number"
                        value={Math.round(selectedElement.height)}
                        onChange={(e) =>
                          onUpdateElement({
                            height: Math.max(4, Number(e.target.value) || 4),
                          })
                        }
                        className="h-7 w-full rounded border border-white/10 bg-black/40 px-1.5 text-white"
                      />
                    </label>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    Rotate
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={selectedElement.rotation ?? 0}
                      onChange={(e) =>
                        onUpdateElement({
                          rotation: Number(e.target.value) || 0,
                        })
                      }
                      className="h-7 w-16 rounded border border-white/10 bg-black/40 px-1.5 text-white"
                    />
                    °
                  </label>
                </Section>
                <Section title="Lock & actions">
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleLock}
                      className="flex items-center gap-2 rounded-md border border-white/10 px-2 py-2 text-[11px] text-slate-300 hover:bg-white/5"
                    >
                      {selectedElement.locked ? (
                        <Unlock className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {selectedElement.locked ? "Unlock" : "Lock"}
                    </button>
                    <button
                      type="button"
                      onClick={onDuplicate}
                      disabled={selectedElement.locked}
                      className="rounded-md border border-white/10 px-2 py-2 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-40"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={selectedElement.locked}
                      className="rounded-md border border-red-500/30 px-2 py-2 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </Section>
              </>
            ) : selectedFieldKey ? (
              <Section title="Layout field">
                <button
                  type="button"
                  onClick={onDelete}
                  className="w-full rounded-md border border-red-500/30 px-2 py-2 text-[11px] text-red-300 hover:bg-red-500/10"
                >
                  Remove text box from slide
                </button>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Removed fields can be restored from the slide right-click menu.
                </p>
              </Section>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
