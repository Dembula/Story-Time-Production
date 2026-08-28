"use client";

import { useRef, useState } from "react";
import {
  FolderOpen,
  ImagePlus,
  Link2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecureImage } from "@/components/files/secure-image";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";
import { newId } from "@/lib/treatment-studio/document";
import type { TreatmentAsset } from "@/lib/treatment-studio/types";

const UPLOAD_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif";

type TreatmentAssetsPanelProps = {
  assets: TreatmentAsset[];
  selectedReferenceIds: string[];
  onAssetsChange: (assets: TreatmentAsset[]) => void;
  onToggleReference: (assetId: string) => void;
  onClose: () => void;
};

export function TreatmentAssetsPanel({
  assets,
  selectedReferenceIds,
  onAssetsChange,
  onToggleReference,
  onClose,
}: TreatmentAssetsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [error, setError] = useState("");

  const addAsset = (asset: TreatmentAsset) => {
    onAssetsChange([...assets, asset]);
  };

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter((a) => a.id !== id));
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const url = await uploadContentMediaViaApi(file);
        addAsset({
          id: newId(),
          type: "image",
          url,
          title: file.name.replace(/\.[^.]+$/, ""),
          source: "upload",
          createdAt: new Date().toISOString(),
        });
      }
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
    addAsset({
      id: newId(),
      type: isImage ? "image" : "link",
      url,
      title: titleInput.trim() || undefined,
      source: "url",
      createdAt: new Date().toISOString(),
    });
    setUrlInput("");
    setTitleInput("");
  };

  return (
    <aside className="treatment-assets-panel flex h-full w-72 shrink-0 flex-col border-l border-white/10 bg-[#0c0c0e]">
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
          Upload reference
        </Button>

        <div className="space-y-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image or link URL"
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
          Shared reference library coming soon. Upload or link references for this treatment.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-slate-500">
            No assets yet. Upload images or paste reference links.
          </p>
        ) : (
          <ul className="space-y-2">
            {assets.map((asset) => {
              const selected = selectedReferenceIds.includes(asset.id);
              return (
                <li
                  key={asset.id}
                  className={[
                    "group rounded-lg border p-2 transition",
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
                      />
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
                      {selected ? "On slide — click to remove" : "Click to add to slide"}
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
