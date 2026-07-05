import { getStorageConfig } from "@/lib/storage-config";
import { getAllowedStorageBaseUrls, isAllowedStorageUrl } from "@/lib/storage-origin";

export type StorageObjectRef = {
  bucket: string;
  key: string;
};

export function buildStorageRef(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

export function parseStorageRef(storageRef: string): StorageObjectRef | null {
  if (!storageRef.startsWith("s3://")) return null;
  const withoutPrefix = storageRef.slice(5);
  const slash = withoutPrefix.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: withoutPrefix.slice(0, slash),
    key: withoutPrefix.slice(slash + 1),
  };
}

/** Resolve a platform storage URL or s3:// ref into bucket + key. */
export function resolveStorageObjectRef(value: string): StorageObjectRef | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const fromRef = parseStorageRef(trimmed);
  if (fromRef) return fromRef;

  if (!isAllowedStorageUrl(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    const allowedBases = getAllowedStorageBaseUrls();
    const matchedBase = allowedBases.find((base) => trimmed === base || trimmed.startsWith(`${base}/`));
    if (!matchedBase) return null;

    const base = new URL(matchedBase);
    let key = url.pathname.replace(/^\/+/, "");
    if (base.pathname && base.pathname !== "/") {
      const prefix = base.pathname.replace(/^\/+|\/+$/g, "");
      if (prefix && key.startsWith(`${prefix}/`)) {
        key = key.slice(prefix.length + 1);
      } else if (prefix && key === prefix) {
        key = "";
      }
    }
    if (!key) return null;

    const storage = getStorageConfig();
    const bucketFromHost = url.hostname.match(/^([^.]+)\.s3[.-]/i)?.[1];
    const bucket = bucketFromHost || storage.bucket;
    if (!bucket) return null;

    return {
      bucket,
      key: decodeURIComponent(key),
    };
  } catch {
    return null;
  }
}

export function uploadKeyOwnerUserId(key: string): string | null {
  const parts = key.split("/").filter(Boolean);
  if (parts[0] !== "uploads" || parts.length < 5) return null;
  return parts[3] ?? null;
}

export function guessMimeTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}

export function isLikelyImageRef(value: string): boolean {
  const ref = resolveStorageObjectRef(value);
  const key = ref?.key ?? value;
  return /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(key);
}

export function isLikelyPdfRef(value: string): boolean {
  const ref = resolveStorageObjectRef(value);
  const key = ref?.key ?? value;
  return /\.pdf$/i.test(key);
}
