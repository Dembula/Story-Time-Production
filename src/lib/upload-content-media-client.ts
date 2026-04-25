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

/**
 * Uploads a file through `/api/upload/content-media`.
 * Files larger than {@link CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES} use a presigned S3 PUT
 * so uploads work on Vercel (serverless body limit ~4.5MB).
 */
export async function uploadContentMediaViaApi(file: File): Promise<string> {
  const data = await uploadContentMediaViaApiFull(file);
  return data.publicUrl;
}

export async function uploadContentMediaViaApiFull(file: File): Promise<ContentMediaFinalizePayload> {
  if (file.size <= CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetchWithRetry("/api/upload/content-media", {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as Partial<ContentMediaFinalizePayload> & { error?: string };
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
    }
    if (!data.publicUrl) {
      throw new Error("Upload did not return a file URL");
    }
    return data as ContentMediaFinalizePayload;
  }

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

  let putRes: Response;
  try {
    putRes = await fetchWithRetry(
      presignJson.uploadUrl,
      {
        method: "PUT",
        body: file,
        headers: putHeaders,
      },
      { attempts: 2, retryDelayMs: 700 },
    );
  } catch (err) {
    if (isNetworkFetchError(err)) {
      throw new Error(
        "Upload connection failed before storage accepted the file. Check S3 CORS allows PUT + OPTIONS from this site origin.",
      );
    }
    throw err instanceof Error ? err : new Error("Direct upload failed");
  }

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => "");
    throw new Error(buildDirectUploadFailureMessage(putRes.status, detail));
  }

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
  return completeData as ContentMediaFinalizePayload;
}
