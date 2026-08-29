"use client";

import { useRef, useState } from "react";
import {
  FolderOpen,
  ImagePlus,
  Link2,
  Loader2,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecureImage } from "@/components/files/secure-image";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { newId } from "@/lib/treatment-studio/document";
import type { TreatmentAsset } from "@/lib/treatment-studio/types";
import { TREATMENT_ASSET_MIME } from "./treatment-slide-canvas";

const UPLOAD_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-m4v,.mov,.mp4,.webm";

type TreatmentAssetsPanelProps = {
  assets: TreatmentAsset[];
  selectedReferenceIds: string[];
  onAssetsChange: (assets: TreatmentAsset[]) => void;
  onToggleReference: (assetId: string) => void;
  onClose: () => void;
  projectId?: string;
};

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
}

export function TreatmentAssetsPanel({
  assets,
  selectedReferenceIds,
  onAssetsChange,
  onToggleReference,
  onClose,
  projectId,
}: TreatmentAssetsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [error, setError] = useState("");

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter((a) => a.id !== id));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded: TreatmentAsset[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadContentMediaViaApi(file);
        uploaded.push({
          id: newId(),
          type: isVideoFile(file) ? "video" : "image",
          url,
          title: file.name.replace(/\.[^.]+$/, ""),
          source: "upload",
          createdAt: new Date().toISOString(),
        });
      }
      onAssetsChange([...assets, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    const isImage = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
    const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
    onAssetsChange([
      ...assets,
      {
        id: newId(),
        type: isVideo ? "video" : isImage ? "image" : "link",
        url,
        title: titleInput.trim() || undefined,
        source: "url",
        createdAt: new Date().toISOString(),
      },
    ]);
    setUrlInput("");
    setTitleInput("");
  };

  return (
    <aside className="treatment-assets-panel flex h-full w-72 shrink-0 flex-col border-l border-white/10 bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <FolderOpen className="h-4 w-4 text-slate-400" />
          Assets
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white"
          aria-label="Close assets panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 border-b border-white/10 p-4">
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Upload still / clip"}
        </Button>

        <div className="space-y-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image or video URL"
            className="h-8 border-white/10 bg-black/40 text-xs text-white"
          />
          <Input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Label (optional)"
            className="h-8 border-white/10 bg-black/40 text-xs text-white"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-slate-300 hover:text-white"
            onClick={handleAddUrl}
            disabled={!urlInput.trim()}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Add from URL
          </Button>
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <p className="text-[10px] leading-relaxed text-slate-500">
          Click an asset to place it on the active slide, or drag it onto the canvas.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-slate-500">
            No assets yet. Upload images, clips, or paste reference links.
          </p>
        ) : (
          <ul className="space-y-2">
            {assets.map((asset) => {
              const selected = selectedReferenceIds.includes(asset.id);
              const previewSrc =
                asset.type === "video"
                  ? resolveRenderableFileSource(asset.thumbnailUrl || asset.url, {
                      projectId,
                    })
                  : null;
              return (
                <li
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TREATMENT_ASSET_MIME, asset.id);
                    e.dataTransfer.setData("text/plain", asset.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={[
                    "group cursor-grab rounded-lg border p-2 transition active:cursor-grabbing",
                    selected
                      ? "border-orange-400/40 bg-orange-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onToggleReference(asset.id)}
                  >
                    {asset.type === "image" ? (
                      <SecureImage
                        fileRef={asset.url}
                        alt={asset.title || "Asset"}
                        className="aspect-video w-full rounded object-cover"
                        projectId={projectId}
                      />
                    ) : asset.type === "video" ? (
                      <div className="relative aspect-video overflow-hidden rounded bg-slate-800">
                        {previewSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={previewSrc}
                            alt={asset.title || "Clip"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-500">
                            <Video className="h-6 w-6" />
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
                          Clip
                        </span>
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded bg-slate-800 px-2 text-center text-[10px] text-slate-400">
                        <Link2 className="mr-1 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{asset.title || asset.url}</span>
                      </div>
                    )}
                    <p className="mt-1.5 truncate text-xs text-slate-300">
                      {asset.title || "Untitled"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {selected ? "On slide — click to remove" : "Click or drag onto slide"}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAsset(asset.id)}
                    className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
