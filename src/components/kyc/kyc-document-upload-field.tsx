"use client";

import { useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 12 * 1024 * 1024;

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 500 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.floor(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.floor(bitmap.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

async function uploadKycFile(file: File, documentType: string): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Only JPG, PNG, or PDF files are allowed.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File exceeds 12MB limit.");
  const prepared = await compressImageIfNeeded(file);
  const fd = new FormData();
  fd.append("file", prepared);
  fd.append("documentType", documentType);
  const res = await fetch("/api/upload/kyc-document", { method: "POST", body: fd });
  const body = (await res.json().catch(() => ({}))) as { storageRef?: string; error?: string };
  if (!res.ok || !body.storageRef) throw new Error(body.error || "Upload failed.");
  return body.storageRef;
}

export function KycDocumentUploadField({
  label,
  documentType,
  value,
  persistBusy,
  onUploaded,
  onPersistDraft,
}: {
  label: string;
  documentType: string;
  value: string;
  persistBusy?: boolean;
  onUploaded: (url: string) => void;
  onPersistDraft?: (url: string) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const busy = uploading || Boolean(persistBusy);

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadKycFile(file, documentType);
      onUploaded(url);
      await onPersistDraft?.(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{label}</label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className="rounded-xl border border-dashed border-slate-600 bg-slate-900/70 p-4 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-slate-400">Drag & drop or</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
        >
          {uploading ? "Uploading..." : persistBusy ? "Saving..." : "Upload file"}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">JPG, PNG, PDF · Max 12MB · Images auto-compressed</p>
      </div>
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
      {value ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
          <span>Uploaded</span>
          <span className="text-slate-400">Stored in private vault</span>
          <button type="button" className="text-red-300 underline" onClick={() => onUploaded("")}>
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
