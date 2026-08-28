"use client";

import { useRef } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  findSubtitleLanguage,
  nextSubtitleLanguage,
  SUBTITLE_SA_LANGUAGES,
  SUBTITLE_WORLD_LANGUAGES,
} from "@/lib/subtitles/languages";
import { prepareSubtitleUploadFile } from "@/lib/subtitles/srt-to-vtt";
import type { CatalogueUploadAsset } from "@/lib/catalogue-upload/types";

export type SubtitleDraft = {
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

type SubtitleUploadSectionProps = {
  subtitles: SubtitleDraft[];
  onChange: (next: SubtitleDraft[]) => void;
  onUploadFile: (
    file: File,
    meta: { subtitleIndex: number; language: string; label: string; isDefault: boolean },
  ) => void;
  onClearUpload: (subtitleIndex: number) => void;
  jobAssets?: CatalogueUploadAsset[];
};

function subtitleAssetForIndex(assets: CatalogueUploadAsset[] | undefined, index: number) {
  return assets?.find((asset) => asset.kind === "subtitle" && asset.meta?.subtitleIndex === index);
}

export function SubtitleUploadSection({
  subtitles,
  onChange,
  onUploadFile,
  onClearUpload,
  jobAssets,
}: SubtitleUploadSectionProps) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function addRow() {
    const nextLanguage = nextSubtitleLanguage(subtitles.map((row) => row.language));
    onChange([
      ...subtitles,
      {
        language: nextLanguage.bcp47,
        label: nextLanguage.label,
        vttUrl: "",
        isDefault: subtitles.length === 0,
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<SubtitleDraft>) {
    onChange(subtitles.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onClearUpload(index);
    const next = subtitles.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((row) => row.isDefault)) {
      next[0] = { ...next[0]!, isDefault: true };
    }
    onChange(next);
  }

  async function handleFilePick(index: number, file: File | null) {
    if (!file) return;
    const row = subtitles[index];
    if (!row) return;

    const prepared = await prepareSubtitleUploadFile(file);
    onUploadFile(prepared, {
      subtitleIndex: index,
      language: row.language,
      label: row.label,
      isDefault: row.isDefault,
    });
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Subtitles (optional)</h3>
          <p className="mt-1 text-xs text-slate-400">
            Upload WebVTT (.vtt) or SubRip (.srt) files for closed captions. Not required to submit.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add language
        </button>
      </div>

      {subtitles.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">No subtitle files added.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {subtitles.map((row, index) => {
            const asset = subtitleAssetForIndex(jobAssets, index);
            const uploading = asset?.status === "uploading" || asset?.status === "queued";
            const done = Boolean(row.vttUrl) && !uploading;
            const currentLanguage = findSubtitleLanguage(row.language);
            return (
              <div
                key={`${row.language}-${index}`}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <label className="block text-xs text-slate-400">
                    Language
                    <select
                      value={row.language}
                      onChange={(e) => {
                        const lang = findSubtitleLanguage(e.target.value);
                        updateRow(index, {
                          language: e.target.value,
                          label: lang?.label ?? row.label,
                        });
                      }}
                      className="storytime-select creator-tool-select mt-1 w-full text-sm"
                    >
                      {!currentLanguage ? (
                        <option value={row.language}>{row.language}</option>
                      ) : null}
                      <optgroup label="South African official">
                        {SUBTITLE_SA_LANGUAGES.map((lang) => (
                          <option key={lang.bcp47} value={lang.bcp47}>
                            {lang.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="All languages">
                        {SUBTITLE_WORLD_LANGUAGES.map((lang) => (
                          <option key={lang.bcp47} value={lang.bcp47}>
                            {lang.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>

                  <label className="block text-xs text-slate-400">
                    Display label
                    <input
                      value={row.label}
                      onChange={(e) => updateRow(index, { label: e.target.value })}
                      className="storytime-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                      placeholder="English"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 md:pb-2">
                    <input
                      type="radio"
                      name="default-subtitle"
                      checked={row.isDefault}
                      onChange={() =>
                        onChange(
                          subtitles.map((item, i) => ({ ...item, isDefault: i === index })),
                        )
                      }
                    />
                    Default track
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[index] = el;
                    }}
                    type="file"
                    accept=".vtt,.srt,text/vtt,application/x-subrip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      void handleFilePick(index, file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[index]?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-100 hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {done ? "Replace file" : "Choose .vtt / .srt"}
                  </button>
                  {uploading ? (
                    <span className="text-xs text-orange-300">
                      Uploading…
                      {asset?.progress != null ? ` ${Math.round(asset.progress)}%` : ""}
                    </span>
                  ) : null}
                  {done ? <span className="text-xs text-emerald-300">Ready</span> : null}
                  {asset?.error ? <span className="text-xs text-red-300">{asset.error}</span> : null}
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
