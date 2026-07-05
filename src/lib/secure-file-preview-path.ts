import { isPlatformStorageReference } from "@/lib/secure-file-access";

export function buildSecureFilePreviewPath(
  fileRef: string,
  options?: { context?: "marketplace" | "admin"; projectId?: string; portalToken?: string },
): string {
  const params = new URLSearchParams({ ref: fileRef });
  if (options?.portalToken) {
    params.set("portalToken", options.portalToken);
  } else if (options?.projectId) {
    params.set("context", "project");
    params.set("projectId", options.projectId);
  } else if (options?.context) {
    params.set("context", options.context);
  }
  return `/api/files/preview?${params.toString()}`;
}

export function resolveRenderableFileSource(
  fileRef: string | null | undefined,
  options?: { context?: "marketplace" | "admin"; projectId?: string; portalToken?: string },
): string | null {
  if (!fileRef?.trim()) return null;
  if (!isPlatformStorageReference(fileRef)) return fileRef;
  return buildSecureFilePreviewPath(fileRef, options);
}
