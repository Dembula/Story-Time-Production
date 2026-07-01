export type DailiesMediaType = "video" | "still";

const STILL_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "avif",
  "bmp",
  "tif",
  "tiff",
  "dng",
  "cr2",
  "nef",
]);

export const DAILIES_UPLOAD_ACCEPT =
  "video/*,image/*,.heic,.heif,.dng,.cr2,.nef,.tif,.tiff";

export function inferDailiesMediaTypeFromFile(file: File): DailiesMediaType {
  if (file.type.startsWith("image/")) return "still";
  if (file.type.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && STILL_EXTENSIONS.has(ext)) return "still";
  return "video";
}

export function inferDailiesMediaTypeFromUrl(url: string | null | undefined): DailiesMediaType {
  if (!url) return "video";
  const path = url.split("?")[0] ?? "";
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && STILL_EXTENSIONS.has(ext)) return "still";
  return "video";
}

export function resolveDailiesMediaType(input: {
  mediaType?: string | null;
  metadata?: unknown;
  videoUrl?: string | null;
}): DailiesMediaType {
  if (input.mediaType === "still" || input.mediaType === "video") {
    return input.mediaType;
  }
  const meta =
    input.metadata && typeof input.metadata === "object"
      ? (input.metadata as { mediaType?: string })
      : null;
  if (meta?.mediaType === "still" || meta?.mediaType === "video") {
    return meta.mediaType;
  }
  return inferDailiesMediaTypeFromUrl(input.videoUrl);
}

export function isDailiesStillMedia(mediaType: DailiesMediaType): boolean {
  return mediaType === "still";
}

export function dailiesStreamStatusForUpload(
  mediaType: DailiesMediaType,
  hasUrl: boolean,
): "pending" | "processing" | "ready" {
  if (!hasUrl) return "pending";
  if (mediaType === "still") return "ready";
  return "processing";
}

export function dailiesMediaTypeLabel(mediaType: DailiesMediaType): string {
  return mediaType === "still" ? "Still" : "Clip";
}
