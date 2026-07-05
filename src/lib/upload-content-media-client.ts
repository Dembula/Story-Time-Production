import { CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES } from "@/lib/content-media-shared";
import type { ContentMediaFinalizePayload } from "@/lib/content-media-post-upload";

export type { ContentMediaFinalizePayload };

const NETWORK_ERROR_NAMES = new Set(["TypeError"]);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function isNetworkFetchError(error: unknown): boolean {
  return error instanceof Error && NETWORK_ERROR_NAMES.has(error.name);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  options?: { attempts?: number; retryDelayMs?: number },
): Promise<Response> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const retryDelayMs = Math.max(150, options?.retryDelayMs ?? 500);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(input, init);
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        await wait(retryDelayMs * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!isNetworkFetchError(err) || i >= attempts - 1) break;
      await wait(retryDelayMs * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network request failed");
}

function buildDirectUploadFailureMessage(status: number, detail: string): string {
  if (detail.includes("SignatureDoesNotMatch")) {
    return "Direct upload signature mismatch. Confirm bucket region/env vars match and retry.";
  }
  if (detail.includes("AccessDenied")) {
    return "Direct upload was denied by S3 policy/CORS. Ensure bucket CORS allows PUT + OPTIONS from this app origin.";
  }
  if (detail.includes("<Error>")) {
    return "Direct upload to storage was rejected. Check S3 CORS (PUT + OPTIONS from your app origin) and bucket policy.";
  }
  return `Direct upload failed (${status}). Check S3 CORS allows PUT + OPTIONS for this exact site origin.`;
}

async function xhrPutWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable) return;
      onProgress((ev.loaded / ev.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(buildDirectUploadFailureMessage(xhr.status, xhr.responseText || "")));
    };
    xhr.onerror = () =>
      reject(new Error("Upload connection failed. Check network and S3 CORS (PUT + OPTIONS)."));
    xhr.send(file);
  });
}

function isPresignUnavailableError(message: string): boolean {
  return /credentials are required|not configured|could not start upload/i.test(message);
}

async function uploadContentMediaViaServerProxy(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ContentMediaFinalizePayload> {
  onProgress?.(8);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithRetry("/api/upload/content-media", {
    method: "POST",
    body: formData,
  });
  onProgress?.(85);
  const data = (await res.json().catch(() => ({}))) as Partial<ContentMediaFinalizePayload> & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  if (!data.publicUrl) {
    throw new Error("Upload did not return a file URL");
  }
  onProgress?.(100);
  return data as ContentMediaFinalizePayload;
}

async function uploadContentMediaViaPresignedPut(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ContentMediaFinalizePayload> {
  onProgress?.(2);
  const presignRes = await fetchWithRetry("/api/upload/content-media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      size: file.size,
      contentType: file.type || undefined,
    }),
  });
  const presignJson = (await presignRes.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    key?: string;
    contentType?: string;
    headers?: Record<string, string>;
  };
  if (!presignRes.ok) {
    throw new Error(typeof presignJson.error === "string" ? presignJson.error : "Could not start upload");
  }
  if (!presignJson.uploadUrl || !presignJson.key || !presignJson.contentType) {
    throw new Error("Invalid presign response");
  }

  const putHeaders: Record<string, string> = {
    ...(presignJson.headers ?? {}),
    "Content-Type": presignJson.contentType,
  };

  try {
    await xhrPutWithProgress(presignJson.uploadUrl, file, putHeaders, (pct) => {
      onProgress?.(5 + pct * 0.88);
    });
  } catch (err) {
    if (isNetworkFetchError(err)) {
      throw new Error(
        "Upload connection failed before storage accepted the file. Check S3 CORS allows PUT + OPTIONS from this site origin.",
      );
    }
    throw err instanceof Error ? err : new Error("Direct upload failed");
  }

  onProgress?.(96);
  const completeRes = await fetchWithRetry("/api/upload/content-media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: presignJson.key,
      contentType: presignJson.contentType,
      fileName: file.name,
    }),
  });
  const completeData = (await completeRes.json().catch(() => ({}))) as Partial<ContentMediaFinalizePayload> & {
    error?: string;
  };
  if (!completeRes.ok) {
    throw new Error(typeof completeData.error === "string" ? completeData.error : "Could not finalize upload");
  }
  if (!completeData.publicUrl) {
    throw new Error("Finalize did not return a file URL");
  }
  onProgress?.(100);
  return completeData as ContentMediaFinalizePayload;
}

/**
 * Uploads a file through `/api/upload/content-media`.
 * Uses presigned direct-to-S3 PUT for all sizes (fastest path). Small files fall back to
 * server proxy only when presigned uploads are unavailable (missing S3 credentials).
 */
export async function uploadContentMediaViaApi(
  file: File,
  options?: { onProgress?: (pct: number) => void },
): Promise<string> {
  const data = await uploadContentMediaViaApiFull(file, options);
  return preferredStorageReference(data);
}

/** Prefer private storage ref for DB persistence; fall back to legacy public URL. */
export function preferredStorageReference(payload: ContentMediaFinalizePayload): string {
  return payload.storageRef || payload.publicUrl;
}

export async function uploadContentMediaViaApiFull(
  file: File,
  options?: { onProgress?: (pct: number) => void },
): Promise<ContentMediaFinalizePayload> {
  const onProgress = options?.onProgress;
  try {
    return await uploadContentMediaViaPresignedPut(file, onProgress);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (file.size <= CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES && isPresignUnavailableError(message)) {
      return uploadContentMediaViaServerProxy(file, onProgress);
    }
    throw err;
  }
}
