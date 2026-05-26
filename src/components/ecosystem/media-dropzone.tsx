"use client";

import { useCallback, useRef, useState } from "react";
import { Film, Upload, CheckCircle, AlertCircle } from "lucide-react";

type MediaDropzoneProps = {
  label: string;
  hint?: string;
  accept?: string;
  uploading?: boolean;
  progress?: number | null;
  done?: boolean;
  error?: string | null;
  onFile: (file: File) => void | Promise<void>;
  children?: React.ReactNode;
};

export function MediaDropzone({
  label,
  hint,
  accept = "video/*",
  uploading = false,
  progress = null,
  done = false,
  error = null,
  onFile,
  children,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void onFile(file);
    },
    [onFile],
  );

  const pct = progress != null ? Math.min(100, Math.max(0, Math.round(progress))) : null;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
        <Film className="h-4 w-4 text-orange-400" />
        {label}
      </label>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={[
          "cinematic-glass cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition",
          dragOver ? "border-orange-400/60 bg-orange-500/5" : "border-white/12 hover:border-orange-400/35",
          uploading ? "pointer-events-none opacity-90" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {done && !uploading ? (
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
        ) : error ? (
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
        ) : (
          <Upload className="mx-auto mb-2 h-8 w-8 text-orange-300/80" />
        )}
        <p className="text-sm font-medium text-white">
          {uploading ? "Uploading…" : done ? "Upload complete" : "Drag & drop or click to browse"}
        </p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        {uploading && pct != null ? (
          <div className="mx-auto mt-4 max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">{pct}%</p>
          </div>
        ) : uploading ? (
          <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500" />
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      </div>
      {children}
    </div>
  );
}
