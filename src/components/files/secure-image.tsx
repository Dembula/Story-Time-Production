"use client";

import { useMemo } from "react";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";

export function SecureImage({
  fileRef,
  alt = "",
  className,
  context = "marketplace",
  projectId,
}: {
  fileRef: string | null | undefined;
  alt?: string;
  className?: string;
  context?: "marketplace" | "admin";
  projectId?: string;
}) {
  const src = useMemo(
    () => resolveRenderableFileSource(fileRef, { context, projectId }),
    [fileRef, context, projectId],
  );
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
