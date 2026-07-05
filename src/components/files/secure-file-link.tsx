"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2, X } from "lucide-react";
import { isLikelyImageRef, isLikelyPdfRef } from "@/lib/storage-object-ref";
import { isPlatformStorageReference } from "@/lib/secure-file-access";
import { buildSecureFilePreviewPath } from "@/lib/secure-file-preview-path";

type Props = {
  fileRef: string;
  label?: string;
  className?: string;
  context?: "marketplace" | "admin";
  projectId?: string;
};

export function SecureFileLink({
  fileRef,
  label = "View file",
  className = "text-xs text-orange-400 hover:underline inline-flex items-center gap-1",
  context = "marketplace",
  projectId,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!fileRef?.trim()) return null;

  if (!isPlatformStorageReference(fileRef)) {
    return (
      <a href={fileRef} target="_blank" rel="noopener noreferrer" className={className}>
        <ExternalLink className="h-3 w-3" />
        {label}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <FileText className="h-3 w-3" />
        {label}
      </button>
      {open ? (
        <SecureFilePreviewModal
          fileRef={fileRef}
          label={label}
          context={context}
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SecureFilePreviewModal({
  fileRef,
  label,
  context,
  projectId,
  onClose,
}: {
  fileRef: string;
  label: string;
  context: "marketplace" | "admin";
  projectId?: string;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const previewPath = buildSecureFilePreviewPath(fileRef, { context, projectId });
  const isImage = isLikelyImageRef(fileRef);
  const isPdf = isLikelyPdfRef(fileRef);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(previewPath);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Could not load file");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load file");
    } finally {
      setLoading(false);
    }
  }, [previewPath]);

  useEffect(() => {
    void load();
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [load]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-medium text-white">{label}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading secure preview…
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {!loading && !error && blobUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt={label} className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain" />
          ) : null}
          {!loading && !error && blobUrl && isPdf ? (
            <iframe title={label} src={blobUrl} className="h-[70vh] w-full rounded-lg border border-slate-800 bg-white" />
          ) : null}
          {!loading && !error && blobUrl && !isImage && !isPdf ? (
            <div className="space-y-3 text-sm text-slate-300">
              <p>Preview is not available for this file type in the browser.</p>
              <a
                href={blobUrl}
                download
                className="inline-flex items-center gap-1 rounded-lg border border-orange-500/40 px-3 py-2 text-orange-200 hover:bg-orange-500/10"
              >
                <ExternalLink className="h-4 w-4" />
                Download file
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
