"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VISUAL_PLANNING_CATEGORIES,
  type VisualPlanningCategoryId,
} from "@/lib/visual-planning-categories";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

export type VisualPlanningAsset = {
  id: string;
  category: string;
  imageUrl: string;
  title: string | null;
  caption: string | null;
  sortOrder: number;
};

const VISUAL_UPLOAD_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif";

async function uploadToStorage(file: File): Promise<string> {
  return uploadContentMediaViaApi(file);
}

export function VisualPlanningCatalogue({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<VisualPlanningCategoryId | "all">("all");
  const [uploadCategory, setUploadCategory] = useState<VisualPlanningCategoryId>("moodboard");
  const [pasteUrl, setPasteUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [brokenAssetIds, setBrokenAssetIds] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["project-visual-assets", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/visual-assets`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Failed to load assets");
      return j as { assets: VisualPlanningAsset[] };
    },
  });

  const assets = data?.assets ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: { category: VisualPlanningCategoryId; imageUrl: string; title?: string }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/visual-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not save image");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-visual-assets", projectId] });
      setPasteUrl("");
      setUploadError("");
    },
    onError: (e: Error) => setUploadError(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      title?: string | null;
      caption?: string | null;
      category?: VisualPlanningCategoryId;
    }) => {
      const res = await fetch(`/api/creator/projects/${projectId}/visual-assets/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          caption: payload.caption,
          category: payload.category,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not update");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-visual-assets", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/creator/projects/${projectId}/visual-assets/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not delete");
      return j;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-visual-assets", projectId] });
    },
  });

  const filtered =
    filter === "all" ? assets : assets.filter((a) => a.category === filter);

  const labelFor = (cat: string) =>
    VISUAL_PLANNING_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    setUploadError("");
    try {
      const imageUrl = await uploadToStorage(file);
      createMutation.mutate({ category: uploadCategory, imageUrl, title: file.name.replace(/\.[^.]+$/, "") });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function addFromUrl() {
    const u = pasteUrl.trim();
    if (!/^https?:\/\//i.test(u)) {
      setUploadError("Paste a full image URL (https://…)");
      return;
    }
    setUploadError("");
    createMutation.mutate({ category: uploadCategory, imageUrl: u });
  }

  return (
    <div className="creator-glass-panel p-4 md:p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Visual catalogue</h3>
          <p className="text-[11px] text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Upload references by category — world, mood, tone, direction, characters, locations, and scenes. Add titles and notes
            so everyone shares the same sense of <span className="text-slate-400">tone, direction, and feel</span>.
          </p>
        </div>
        <span className="text-[11px] text-slate-500 shrink-0">{assets.length} image{assets.length === 1 ? "" : "s"}</span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-wide text-slate-500">Category for new images</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as VisualPlanningCategoryId)}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-[11px] text-white outline-none focus:border-orange-500"
            >
              {VISUAL_PLANNING_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <input ref={fileRef} type="file" accept={VISUAL_UPLOAD_ACCEPT} className="hidden" onChange={onPickFile} />
          <Button
            type="button"
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
            disabled={createMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
            )}
            Upload image
          </Button>
          <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[200px]">
            <Input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="Or paste image URL…"
              className="bg-slate-950 border-slate-700 text-[11px] h-9 flex-1 min-w-[180px]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-200 text-xs"
              disabled={createMutation.isPending || !pasteUrl.trim()}
              onClick={addFromUrl}
            >
              Add URL
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Supported image formats: JPG, PNG, WEBP, AVIF, GIF, HEIC/HEIF. If a device cannot decode HEIC/HEIF, open the source
          file link or upload JPG/PNG for universal display.
        </p>
        {uploadError ? <p className="text-[11px] text-amber-200/90">{uploadError}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-[11px] transition ${
            filter === "all"
              ? "border-orange-500 bg-orange-500/20 text-orange-100"
              : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
          }`}
        >
          All
        </button>
        {VISUAL_PLANNING_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            title={c.blurb}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              filter === c.id
                ? "border-orange-500 bg-orange-500/20 text-orange-100"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {c.label}
            <span className="text-slate-500 ml-1">({assets.filter((a) => a.category === c.id).length})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500 py-8 text-center">Loading catalogue…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/80">
          No images in this view yet. Upload stills, lookbook frames, or paste links — build a shared visual library for the team.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="group flex flex-col rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-sm hover:border-slate-600/80 transition"
            >
              <div className="relative aspect-[3/4] bg-slate-900">
                <img
                  src={a.imageUrl}
                  alt={a.title || "Reference"}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setBrokenAssetIds((prev) => ({ ...prev, [a.id]: true }))}
                />
                {brokenAssetIds[a.id] ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/90 px-2 text-center text-[10px] text-amber-200">
                    <span>Could not display this image on this device.</span>
                    <a href={a.imageUrl} target="_blank" rel="noreferrer" className="text-orange-300 underline">
                      Open source file
                    </a>
                  </div>
                ) : null}
                <div className="absolute top-2 left-2">
                  <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm">
                    {labelFor(a.category)}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-1.5 flex-1 flex flex-col">
                <select
                  key={`${a.id}-cat-${a.category}`}
                  defaultValue={a.category}
                  className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-orange-500"
                  onChange={(e) => {
                    const next = e.target.value as VisualPlanningCategoryId;
                    if (next === a.category) return;
                    patchMutation.mutate({ id: a.id, category: next });
                  }}
                >
                  {VISUAL_PLANNING_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <Input
                  defaultValue={a.title ?? ""}
                  key={`${a.id}-title`}
                  placeholder="Title"
                  className="h-8 bg-slate-900/80 border-slate-700 text-[11px]"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const prev = a.title ?? "";
                    if (v === prev) return;
                    patchMutation.mutate({ id: a.id, title: v || null });
                  }}
                />
                <textarea
                  defaultValue={a.caption ?? ""}
                  key={`${a.id}-cap`}
                  placeholder="Tone, direction, feel…"
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-orange-500 resize-none flex-1 min-h-[3.5rem]"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const prev = a.caption ?? "";
                    if (v === prev) return;
                    patchMutation.mutate({ id: a.id, caption: v || null });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px] text-red-300/90 hover:text-red-200 hover:bg-red-500/10 justify-start"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (!window.confirm("Remove this image from the catalogue?")) return;
                    deleteMutation.mutate(a.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
