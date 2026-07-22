import {
  CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES,
  CONTENT_MEDIA_MULTIPART_CONCURRENCY,
  CONTENT_MEDIA_MULTIPART_PART_SIZE_BYTES,
  shouldUseMultipartUpload,
} from "@/lib/content-media-shared";
import type { ContentMediaFinalizePayload } from "@/lib/content-media-post-upload";

export type { ContentMediaFinalizePayload };

const NETWORK_ERROR_NAMES = new Set(["TypeError"]);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
/** How many part URLs to fetch ahead of the upload pool. */
const SIGN_BATCH_SIZE = 24;
/** Abort a stalled part if no progress bytes for this long. */
const PART_STALL_TIMEOUT_MS = 90_000;
/** Absolute ceiling per part attempt (slow links still finish large chunks). */
const PART_HARD_TIMEOUT_MS = 45 * 60 * 1000;

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
  options?: { timeoutMs?: number; stallTimeoutMs?: number; onBytes?: (loaded: number) => void },
): Promise<{ etag: string | null }> {
  return await new Promise<{ etag: string | null }>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    let lastPct = 0;
    let lastLoaded = 0;
    let lastProgressAt = Date.now();
    let settled = false;
    const timeoutMs = options?.timeoutMs ?? 0;
    const stallTimeoutMs = options?.stallTimeoutMs ?? 0;
    let stallTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      settled = true;
      if (stallTimer) {
        clearInterval(stallTimer);
        stallTimer = null;
      }
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    const fail = (err: Error) => {
      if (settled) return;
      cleanup();
      try {
        xhr.abort();
      } catch {
        // ignore
      }
      reject(err);
    };

    const succeed = (etag: string | null) => {
      if (settled) return;
      cleanup();
      resolve({ etag });
    };

    const onAbort = () => {
      fail(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.open("PUT", url);
    if (timeoutMs > 0) xhr.timeout = timeoutMs;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (ev) => {
      const loaded = ev.lengthComputable ? ev.loaded : ev.loaded;
      if (loaded > lastLoaded) {
        lastLoaded = loaded;
        lastProgressAt = Date.now();
        options?.onBytes?.(loaded);
      }
      if (!onProgress || !ev.lengthComputable || ev.total <= 0) return;
      const next = (ev.loaded / ev.total) * 100;
      // Never report a lower % for this XHR (avoids bar jitter from event ordering).
      if (next + 0.05 < lastPct) return;
      lastPct = Math.max(lastPct, next);
      onProgress(lastPct);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options?.onBytes?.(body.size);
        const etag =
          xhr.getResponseHeader("ETag") ||
          xhr.getResponseHeader("etag") ||
          xhr.getResponseHeader("Etag");
        succeed(etag);
      } else {
        fail(new Error(buildDirectUploadFailureMessage(xhr.status, xhr.responseText || "")));
      }
    };
    xhr.onerror = () =>
      fail(
        new Error(
          "Upload connection failed (often S3 CORS). Ensure bucket CORS allows PUT + OPTIONS from this exact site origin and ExposeHeaders includes ETag. See deploy/connection-pack/s3-cors.json.",
        ),
      );
    xhr.ontimeout = () =>
      fail(new Error("Upload part timed out. Check your connection and retry — large masters upload in chunks."));
    xhr.onabort = () => {
      if (settled) return;
      fail(new DOMException("Upload aborted", "AbortError"));
    };
    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
    if (stallTimeoutMs > 0) {
      stallTimer = setInterval(() => {
        if (settled) return;
        if (Date.now() - lastProgressAt >= stallTimeoutMs) {
          fail(
            new Error(
              "Upload stalled (no progress). Retrying this chunk — keep the tab open and check your connection.",
            ),
          );
        }
      }, Math.min(5_000, Math.max(1_000, Math.floor(stallTimeoutMs / 6))));
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

async function fetchSignedPartUrls(options: {
  key: string;
  uploadId: string;
  partNumbers: number[];
  signal?: AbortSignal;
}): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (options.partNumbers.length === 0) return map;

  const batchRes = await fetchWithRetry(
    "/api/upload/content-media/multipart/sign-batch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: options.key,
        uploadId: options.uploadId,
        partNumbers: options.partNumbers,
      }),
      signal: options.signal,
    },
    { attempts: 4, retryDelayMs: 400 },
  );
  const batchJson = (await batchRes.json().catch(() => ({}))) as {
    error?: string;
    urls?: Array<{ partNumber?: number; uploadUrl?: string }>;
  };

  if (batchRes.ok && Array.isArray(batchJson.urls) && batchJson.urls.length > 0) {
    for (const row of batchJson.urls) {
      const n = Number(row.partNumber);
      const url = typeof row.uploadUrl === "string" ? row.uploadUrl : "";
      if (Number.isInteger(n) && url) map.set(n, url);
    }
    return map;
  }

  // Fallback: older deploy without sign-batch — sign one-by-one.
  await Promise.all(
    options.partNumbers.map(async (partNumber) => {
      const signRes = await fetchWithRetry(
        "/api/upload/content-media/multipart/sign-part",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: options.key,
            uploadId: options.uploadId,
            partNumber,
          }),
          signal: options.signal,
        },
      );
      const signJson = (await signRes.json().catch(() => ({}))) as {
        error?: string;
        uploadUrl?: string;
      };
      if (!signRes.ok || !signJson.uploadUrl) {
        throw new Error(
          typeof signJson.error === "string"
            ? signJson.error
            : typeof batchJson.error === "string"
              ? batchJson.error
              : `Could not sign part ${partNumber}`,
        );
      }
      map.set(partNumber, signJson.uploadUrl);
    }),
  );
  return map;
}

class SignedUrlPrefetcher {
  private readonly urls = new Map<number, string>();
  private nextToPrefetch = 1;
  private activePrefetch: Promise<void> | null = null;

  constructor(
    private readonly key: string,
    private readonly uploadId: string,
    private readonly totalParts: number,
    private readonly signal?: AbortSignal,
  ) {}

  /** Queue background signing so upload workers rarely wait on Vercel. */
  kick(aheadOfPart = 1): void {
    const desired = Math.min(this.totalParts, aheadOfPart + SIGN_BATCH_SIZE);
    if (this.nextToPrefetch > desired || this.nextToPrefetch > this.totalParts) return;
    void this.runPrefetchLoop(desired);
  }

  private async runPrefetchLoop(desired: number): Promise<void> {
    if (this.activePrefetch) {
      await this.activePrefetch;
      if (this.nextToPrefetch <= desired && this.nextToPrefetch <= this.totalParts) {
        await this.runPrefetchLoop(desired);
      }
      return;
    }

    this.activePrefetch = (async () => {
      while (this.nextToPrefetch <= desired && this.nextToPrefetch <= this.totalParts) {
        if (this.signal?.aborted) {
          throw new DOMException("Upload aborted", "AbortError");
        }
        const start = this.nextToPrefetch;
        const end = Math.min(this.totalParts, start + SIGN_BATCH_SIZE - 1, desired);
        const needed: number[] = [];
        for (let n = start; n <= end; n += 1) {
          if (!this.urls.has(n)) needed.push(n);
        }
        this.nextToPrefetch = end + 1;
        if (needed.length === 0) continue;
        const signed = await fetchSignedPartUrls({
          key: this.key,
          uploadId: this.uploadId,
          partNumbers: needed,
          signal: this.signal,
        });
        for (const [n, url] of signed) this.urls.set(n, url);
      }
    })();

    try {
      await this.activePrefetch;
    } finally {
      this.activePrefetch = null;
    }
  }

  async getUrl(partNumber: number): Promise<string> {
    this.kick(partNumber);
    for (let i = 0; i < 60; i += 1) {
      if (this.signal?.aborted) {
        throw new DOMException("Upload aborted", "AbortError");
      }
      const hit = this.urls.get(partNumber);
      if (hit) {
        this.kick(partNumber + 1);
        return hit;
      }
      if (this.activePrefetch) {
        await this.activePrefetch.catch(() => undefined);
        continue;
      }
      break;
    }

    const signed = await fetchSignedPartUrls({
      key: this.key,
      uploadId: this.uploadId,
      partNumbers: [partNumber],
      signal: this.signal,
    });
    const url = signed.get(partNumber);
    if (!url) throw new Error(`Could not sign part ${partNumber}`);
    this.urls.set(partNumber, url);
    this.kick(partNumber + 1);
    return url;
  }

  /** Drop a cached URL so retries get a fresh signature. */
  invalidate(partNumber: number): void {
    this.urls.delete(partNumber);
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
  mediaMeta?: { durationSeconds?: number; estimatedBitrateMbps?: number },
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
    concurrency?: number;
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
  const concurrency = Math.min(
    12,
    Math.max(
      2,
      typeof initJson.concurrency === "number" && initJson.concurrency > 0
        ? Math.floor(initJson.concurrency)
        : CONTENT_MEDIA_MULTIPART_CONCURRENCY,
    ),
  );
  const totalParts = Math.max(1, Math.ceil(file.size / partSize));
  const completedParts: { PartNumber: number; ETag: string }[] = [];
  /** Bytes fully committed from finished parts + in-flight part progress. */
  const partLoadedBytes = new Map<number, number>();
  let committedBytes = 0;

  const reportProgress = () => {
    let inFlight = 0;
    for (const n of partLoadedBytes.values()) inFlight += n;
    const uploadedBytes = committedBytes + inFlight;
    const pct = 2 + Math.min(93, (uploadedBytes / Math.max(1, file.size)) * 93);
    onProgress?.(pct);
  };

  const signer = new SignedUrlPrefetcher(key, uploadId, totalParts, signal);
  signer.kick(1);

  try {
    await runWithConcurrency(
      Array.from({ length: totalParts }, (_, i) => i + 1),
      concurrency,
      async (partNumber) => {
        if (signal?.aborted) {
          throw new DOMException("Upload aborted", "AbortError");
        }
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);

        let lastError: unknown;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            if (signal?.aborted) {
              throw new DOMException("Upload aborted", "AbortError");
            }
            // Fresh URL on retry after stall/network failure.
            if (attempt > 0) signer.invalidate(partNumber);
            const uploadUrl = await signer.getUrl(partNumber);

            partLoadedBytes.set(partNumber, 0);
            reportProgress();

            const { etag } = await xhrPutWithProgress(
              uploadUrl,
              blob,
              {},
              undefined,
              signal,
              {
                timeoutMs: PART_HARD_TIMEOUT_MS,
                stallTimeoutMs: PART_STALL_TIMEOUT_MS,
                onBytes: (loaded) => {
                  partLoadedBytes.set(partNumber, Math.min(blob.size, Math.max(0, loaded)));
                  reportProgress();
                },
              },
            );

            partLoadedBytes.delete(partNumber);
            committedBytes += blob.size;
            reportProgress();

            completedParts.push({ PartNumber: partNumber, ETag: etag || "" });
            return;
          } catch (err) {
            lastError = err;
            partLoadedBytes.delete(partNumber);
            reportProgress();
            if (isAbortError(err)) throw err;
            if (attempt >= 3) break;
            await wait(600 * (attempt + 1));
          }
        }
        throw lastError instanceof Error
          ? lastError
          : new Error(`Failed to upload part ${partNumber}`);
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
      expectedPartCount: totalParts,
      durationSeconds: mediaMeta?.durationSeconds,
      estimatedBitrateMbps: mediaMeta?.estimatedBitrateMbps,
      parts: completedParts
        .filter((p) => p.ETag)
        .sort((a, b) => a.PartNumber - b.PartNumber),
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
  mediaMeta?: { durationSeconds?: number; estimatedBitrateMbps?: number },
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
      durationSeconds: mediaMeta?.durationSeconds,
      estimatedBitrateMbps: mediaMeta?.estimatedBitrateMbps,
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
  /** Browser-probed duration for Stream bitrate routing. */
  durationSeconds?: number;
  estimatedBitrateMbps?: number;
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
  const mediaMeta = {
    durationSeconds: options?.durationSeconds,
    estimatedBitrateMbps: options?.estimatedBitrateMbps,
  };

  if (shouldUseMultipartUpload(file.size)) {
    try {
      return await uploadContentMediaViaMultipart(file, onProgress, signal, mediaMeta);
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw err instanceof Error ? err : new Error("Multipart upload failed");
    }
  }

  try {
    return await uploadContentMediaViaPresignedPut(file, onProgress, signal, mediaMeta);
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
