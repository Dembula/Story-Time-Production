/** Shared rules for `/api/upload/content-media` (server + client hints). */

/** Small assets may fall back to server proxy when S3 CORS PUT fails. */
export const CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * AWS S3 single PutObject hard limit is 5 GiB.
 * Feature-film masters above this MUST use multipart upload.
 */
export const S3_SINGLE_PUT_MAX_BYTES = 5 * 1024 * 1024 * 1024;

/** Use multipart for files at/above this size (reliability + >5GB support). */
export const CONTENT_MEDIA_MULTIPART_THRESHOLD_BYTES = 32 * 1024 * 1024;

/** Fallback part size when adaptive sizing is unavailable. */
export const CONTENT_MEDIA_MULTIPART_PART_SIZE_BYTES = 128 * 1024 * 1024;

/** Parallel S3 part uploads for feature masters. */
export const CONTENT_MEDIA_MULTIPART_CONCURRENCY = 8;

/**
 * Adaptive part size for throughput:
 * - fewer parts → fewer Vercel sign round-trips
 * - larger parts → better saturation of typical broadband
 * S3 limits: min 5 MiB (except last), max 5 GiB, max 10,000 parts.
 */
export function contentMediaMultipartPartSizeBytes(fileSizeBytes: number): number {
  const size = Math.max(0, fileSizeBytes);
  if (size < 512 * 1024 * 1024) return 32 * 1024 * 1024; // <512MB
  if (size < 2 * 1024 * 1024 * 1024) return 64 * 1024 * 1024; // <2GB
  if (size < 8 * 1024 * 1024 * 1024) return 128 * 1024 * 1024; // <8GB
  if (size < 20 * 1024 * 1024 * 1024) return 256 * 1024 * 1024; // <20GB (15GB masters land here)
  return 512 * 1024 * 1024; // 20GB+
}

/**
 * Default catalogue media ceiling: 50 GiB.
 * Override with UPLOAD_MAX_FILE_SIZE_MB.
 */
export const DEFAULT_CONTENT_MEDIA_MAX_UPLOAD_MB = 51200;

export const ALLOWED_CONTENT_MEDIA_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/3gpp",
  "video/3gpp2",
  "video/avi",
  "video/hevc",
  "video/h265",
  "video/mpeg",
  "video/mp2t",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ts: "video/mp2t",
  m2ts: "video/mp2t",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  hevc: "video/hevc",
  h265: "video/h265",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  aac: "audio/aac",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

export function sanitizeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  return ext.replace(/[^a-z0-9]/g, "") || "bin";
}

/**
 * Many browsers send an empty type or `application/octet-stream` for video files.
 * Resolve a concrete MIME from the filename extension when needed.
 */
export function resolveContentTypeForUpload(file: Pick<File, "name" | "type">): string {
  const raw = (file.type || "").trim();
  if (raw && raw !== "application/octet-stream" && ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(raw)) {
    return raw;
  }
  const ext = sanitizeExtension(file.name);
  const fromExt = EXTENSION_TO_MIME[ext];
  if (fromExt && ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(fromExt)) {
    return fromExt;
  }
  if (raw && ALLOWED_CONTENT_MEDIA_MIME_TYPES.has(raw)) {
    return raw;
  }
  return raw || fromExt || "application/octet-stream";
}

export function contentMediaMaxUploadMb(): number {
  const parsed = Number(process.env.UPLOAD_MAX_FILE_SIZE_MB);
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CONTENT_MEDIA_MAX_UPLOAD_MB;
  return Math.floor(mb);
}

export function contentMediaMaxUploadBytes(): number {
  return contentMediaMaxUploadMb() * 1024 * 1024;
}

export function shouldUseMultipartUpload(sizeBytes: number): boolean {
  return sizeBytes >= CONTENT_MEDIA_MULTIPART_THRESHOLD_BYTES;
}

export function formatUploadSizeLimitLabel(maxBytes = contentMediaMaxUploadBytes()): string {
  const gb = maxBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
    return `${rounded}GB`;
  }
  return `${Math.floor(maxBytes / (1024 * 1024))}MB`;
}

export function buildUserScopedUploadKey(userId: string, fileName: string): string {
  const fileExt = sanitizeExtension(fileName);
  const now = new Date();
  return [
    "uploads",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    userId,
    `${now.getTime()}-${Math.random().toString(36).slice(2)}.${fileExt}`,
  ].join("/");
}

/** Presigned / complete flow: key must be scoped to this user (path segment). */
export function contentMediaKeyBelongsToUser(key: string, userId: string): boolean {
  const parts = key.split("/").filter(Boolean);
  return parts[0] === "uploads" && parts.length >= 5 && parts[3] === userId;
}
