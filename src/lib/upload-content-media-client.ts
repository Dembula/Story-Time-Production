import { CONTENT_MEDIA_DIRECT_UPLOAD_MAX_BYTES } from "@/lib/content-media-shared";
import type { ContentMediaFinalizePayload } from "@/lib/content-media-post-upload";

export type { ContentMediaFinalizePayload };

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
    const res = await fetch("/api/upload/content-media", {
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

  const presignRes = await fetch("/api/upload/content-media/presign", {
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

  const putRes = await fetch(presignJson.uploadUrl, {
    method: "PUT",
    body: file,
    headers: putHeaders,
  });

  if (!putRes.ok) {
    const detail = await putRes.text().catch(() => "");
    throw new Error(
      detail?.includes("<Error>")
        ? "Direct upload to storage was rejected. Check S3 CORS (PUT from your site origin) and bucket policy."
        : `Direct upload failed (${putRes.status}). If this persists, add a CORS rule on the S3 bucket for PUT from your app origin.`,
    );
  }

  const completeRes = await fetch("/api/upload/content-media/complete", {
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
