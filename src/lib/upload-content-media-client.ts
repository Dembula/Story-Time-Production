import {
  CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES,
  CONTENT_MEDIA_MULTIPART_PART_SIZE_BYTES,
  shouldUseMultipartUpload,
} from "@/lib/content-media-shared";
import type { ContentMediaFinalizePayload } from "@/lib/content-media-post-upload";

export type { ContentMediaFinalizePayload };

const NETWORK_ERROR_NAMES = new Set(["TypeError"]);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MULTIPART_CONCURRENCY = 3;

function isNetworkFetchError(error: unknown): boolean {
  return error instanceof Error && NETWORK_ERROR_NAMES.has(error.name);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isDirectUploadCorsOrNetworkError(message: string): boolean {
  return /upload connection failed|s3 cors|cors \(put|network and s3|signature mismatch|accessdenied|direct upload was denied|direct upload to storage was rejected|direct upload failed|multipart/i.test(
    message,
  );
}

function isProxyFallbackEligible(file: File, message: string): boolean {
  if (file.size > CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES) return false;
  return isPresignUnavailableError(message) || isDirectUploadCorsOrNetworkError(message);
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
      if (init.signal?.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }
      const res = await fetch(input, init);
      if (RETRYABLE_STATUS.has(res.status) && i < attempts - 1) {
        await wait(retryDelayMs * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (isAbortError(err)) break;
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
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<{ etag: string | null }> {
  return await new Promise<{ etag: string | null }>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    let lastPct = 0;
    xhr.open("PUT", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable || ev.total <= 0) return;
      const next = (ev.loaded / ev.total) * 100;
      // Never report a lower % for this XHR (avoids bar jitter from event ordering).
      if (next + 0.05 < lastPct) return;
      lastPct = Math.max(lastPct, next);
      onProgress(lastPct);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ etag: xhr.getResponseHeader("ETag") });
      } else {
        reject(new Error(buildDirectUploadFailureMessage(xhr.status, xhr.responseText || "")));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Upload connection failed. Check network and S3 CORS (PUT + OPTIONS)."));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    const onAbort = () => xhr.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    xhr.send(body);
  });
}

function isPresignUnavailableError(message: string): boolean {
  return /credentials are required|not configured|could not start upload|could not start multipart/i.test(
    message,
  );
}

async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  try {
    await fetch("/api/upload/content-media/multipart/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, uploadId }),
    });
  } catch {
    // Best-effort cleanup.
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function uploadContentMediaViaMultipart(
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<ContentMediaFinalizePayload> {
  onProgress?.(1);
  const initRes = await fetchWithRetry(
    "/api/upload/content-media/multipart/init",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        size: file.size,
        contentType: file.type || undefined,
      }),
      signal,
    },
  );
  const initJson = (await initRes.json().catch(() => ({}))) as {
    error?: string;
    uploadId?: string;
    key?: string;
    contentType?: string;
    partSize?: number;
  };
  if (!initRes.ok) {
    throw new Error(typeof initJson.error === "string" ? initJson.error : "Could not start multipart upload");
  }
  if (!initJson.uploadId || !initJson.key || !initJson.contentType) {
    throw new Error("Invalid multipart init response");
  }

  const uploadId = initJson.uploadId;
  const key = initJson.key;
  const contentType = initJson.contentType;
  const partSize =
    typeof initJson.partSize === "number" && initJson.partSize > 0
      ? initJson.partSize
      : CONTENT_MEDIA_MULTIPART_PART_SIZE_BYTES;
  const totalParts = Math.max(1, Math.ceil(file.size / partSize));
  const completedParts: { PartNumber: number; ETag: string }[] = [];
  let uploadedBytes = 0;

  const reportProgress = () => {
    const pct = 2 + Math.min(93, (uploadedBytes / Math.max(1, file.size)) * 93);
    onProgress?.(pct);
  };

  try {
    await runWithConcurrency(
      Array.from({ length: totalParts }, (_, i) => i + 1),
      MULTIPART_CONCURRENCY,
      async (partNumber) => {
        if (signal?.aborted) {
          throw new DOMException("Upload aborted", "AbortError");
        }
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);

        const signRes = await fetchWithRetry(
          "/api/upload/content-media/multipart/sign-part",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, uploadId, partNumber }),
            signal,
          },
        );
        const signJson = (await signRes.json().catch(() => ({}))) as {
          error?: string;
          uploadUrl?: string;
        };
        if (!signRes.ok || !signJson.uploadUrl) {
          throw new Error(
            typeof signJson.error === "string" ? signJson.error : `Could not sign part ${partNumber}`,
          );
        }

        let partLoaded = 0;
        const { etag } = await xhrPutWithProgress(
          signJson.uploadUrl,
          blob,
          {},
          (pct) => {
            const delta = blob.size * (pct / 100) - partLoaded;
            if (delta > 0) {
              uploadedBytes += delta;
              partLoaded += delta;
              reportProgress();
            }
          },
          signal,
        );

        if (!etag) {
          throw new Error(
            `Missing ETag for part ${partNumber}. Ensure S3 CORS ExposeHeaders includes ETag.`,
          );
        }

        // Catch any remaining bytes if progress events were sparse.
        if (partLoaded < blob.size) {
          uploadedBytes += blob.size - partLoaded;
          reportProgress();
        }

        completedParts.push({ PartNumber: partNumber, ETag: etag });
      },
    );
  } catch (err) {
    await abortMultipartUpload(key, uploadId);
    throw err;
  }

  onProgress?.(96);
  const completeRes = await fetchWithRetry("/api/upload/content-media/multipart/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      uploadId,
      contentType,
      fileName: file.name,
      parts: completedParts.sort((a, b) => a.PartNumber - b.PartNumber),
    }),
    signal,
  });
  const completeData = (await completeRes.json().catch(() => ({}))) as Partial<ContentMediaFinalizePayload> & {
    error?: string;
  };
  if (!completeRes.ok) {
    await abortMultipartUpload(key, uploadId);
    throw new Error(
      typeof completeData.error === "string" ? completeData.error : "Could not finalize multipart upload",
    );
  }
  if (!completeData.publicUrl) {
    throw new Error("Finalize did not return a file URL");
  }
  onProgress?.(100);
  return completeData as ContentMediaFinalizePayload;
}

async function uploadContentMediaViaServerProxy(
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<ContentMediaFinalizePayload> {
  onProgress?.(8);
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetchWithRetry("/api/upload/content-media", {
    method: "POST",
    body: formData,
    signal,
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
  signal?: AbortSignal,
): Promise<ContentMediaFinalizePayload> {
  onProgress?.(2);
  const presignRes = await fetchWithRetry(
    "/api/upload/content-media/presign",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        size: file.size,
        contentType: file.type || undefined,
      }),
      signal,
    },
  );
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
    await xhrPutWithProgress(
      presignJson.uploadUrl,
      file,
      putHeaders,
      (pct) => {
        onProgress?.(5 + pct * 0.88);
      },
      signal,
    );
  } catch (err) {
    if (isAbortError(err)) throw err;
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
    signal,
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
 * Uses presigned direct-to-S3 PUT (fastest path, required for large video).
 * Small files (poster, backdrop, script, etc. under ~4MB) fall back to the
 * server proxy when browser→S3 CORS/network PUT fails.
 */
export type UploadContentMediaOptions = {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

export async function uploadContentMediaViaApi(
  file: File,
  options?: UploadContentMediaOptions,
): Promise<string> {
  const data = await uploadContentMediaViaApiFull(file, options);
  return preferredStorageReference(data);
}

/** Prefer private storage ref for DB persistence; fall back to legacy public URL.
 * For public catalogue artwork (posters/backdrops), prefer the HTTPS public URL so
 * browsers and next/image can load the asset without packaging `s3://` refs.
 */
export function preferredStorageReference(
  payload: ContentMediaFinalizePayload,
  options?: { preferPublicUrl?: boolean },
): string {
  if (options?.preferPublicUrl) {
    return payload.publicUrl || payload.storageRef;
  }
  return payload.storageRef || payload.publicUrl;
}

/** Best-effort delete of a prior upload when the user replaces or removes it. */
export async function deleteContentMediaFromStorage(storageRefOrUrl: string): Promise<boolean> {
  const value = storageRefOrUrl.trim();
  if (!value) return false;
  try {
    const res = await fetch("/api/upload/content-media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        value.startsWith("s3://") || value.startsWith("http")
          ? { storageRef: value }
          : { key: value },
      ),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadContentMediaViaApiFull(
  file: File,
  options?: UploadContentMediaOptions,
): Promise<ContentMediaFinalizePayload> {
  let highWater = 0;
  const onProgress = options?.onProgress
    ? (pct: number) => {
        highWater = Math.max(highWater, Math.min(100, Math.max(0, pct)));
        options.onProgress?.(highWater);
      }
    : undefined;
  const signal = options?.signal;

  if (shouldUseMultipartUpload(file.size)) {
    try {
      return await uploadContentMediaViaMultipart(file, onProgress, signal);
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw err instanceof Error ? err : new Error("Multipart upload failed");
    }
  }

  try {
    return await uploadContentMediaViaPresignedPut(file, onProgress, signal);
  } catch (err) {
    if (isAbortError(err)) throw err;
    const message = err instanceof Error ? err.message : "";
    if (isProxyFallbackEligible(file, message)) {
      try {
        // Keep high-water so proxy fallback (which starts ~8%) does not yank the bar down.
        return await uploadContentMediaViaServerProxy(file, onProgress, signal);
      } catch (proxyErr) {
        if (isAbortError(proxyErr)) throw proxyErr;
        const proxyMessage = proxyErr instanceof Error ? proxyErr.message : "Upload failed";
        throw new Error(
          `${message} Proxy fallback also failed: ${proxyMessage}`,
        );
      }
    }
    if (isDirectUploadCorsOrNetworkError(message) && file.size > CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES) {
      throw new Error(
        `${message} Large files must upload directly to storage — ask an admin to enable S3 CORS PUT + OPTIONS for this site origin (see deploy/connection-pack/s3-cors.json or scripts/apply-s3-cors.ts).`,
      );
    }
    throw err;
  }
}
