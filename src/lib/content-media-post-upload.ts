import { ingestToCloudflareStreamFromUrl } from "@/lib/cloudflare-stream";
import { upsertStreamAsset } from "@/lib/stream-asset-store";
import { getStorageConfig } from "@/lib/storage-config";

export type ContentMediaFinalizePayload = {
  ok: true;
  bucket: string;
  path: string;
  publicUrl: string;
  sourceUrl: string;
  streamUid: string | null;
  streamStatus: string | null;
  streamPlaybackUrl: string | null;
  streamIframeUrl: string | null;
  streamHlsUrl: string | null;
};

function normalizePublicBaseUrl(bucket: string): string {
  const storage = getStorageConfig();
  const raw = storage.publicBaseUrl;
  const fallback = `https://${bucket}.s3.${storage.region}.amazonaws.com`;
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

/**
 * After the object exists in S3, build public URLs and optionally start Cloudflare Stream ingest for video.
 */
export async function finalizeContentMediaUpload(options: {
  key: string;
  contentType: string;
  fileNameForMeta?: string;
}): Promise<ContentMediaFinalizePayload> {
  const storage = getStorageConfig();
  const bucket = storage.bucket;
  if (!bucket) {
    throw new Error("Storage bucket is not configured");
  }

  const baseUrl = normalizePublicBaseUrl(bucket);
  const sourceUrl = `${baseUrl}/${options.key.split("/").map(encodeURIComponent).join("/")}`;
  let publicUrl = sourceUrl;
  let streamUid: string | null = null;
  let streamStatus: string | null = null;
  let streamPlaybackUrl: string | null = null;
  let streamIframeUrl: string | null = null;
  let streamHlsUrl: string | null = null;

  if (options.contentType.startsWith("video/")) {
    try {
      const stream = await ingestToCloudflareStreamFromUrl(sourceUrl, {
        source: "storytime-upload",
        fileName: options.fileNameForMeta ?? options.key.split("/").pop() ?? "video",
        mime: options.contentType,
      });
      publicUrl = stream.mp4Url;
      streamUid = stream.uid;
      streamStatus = stream.state;
      streamPlaybackUrl = stream.mp4Url;
      streamIframeUrl = stream.iframeUrl;
      streamHlsUrl = stream.hlsUrl;
      await upsertStreamAsset({
        uid: stream.uid,
        sourceUrl,
        playbackUrl: stream.mp4Url,
        hlsUrl: stream.hlsUrl,
        iframeUrl: stream.iframeUrl,
        status: stream.state,
      });
    } catch (streamErr) {
      console.error("Cloudflare Stream ingestion failed; falling back to S3 URL:", streamErr);
    }
  }

  return {
    ok: true,
    bucket,
    path: options.key,
    publicUrl,
    sourceUrl,
    streamUid,
    streamStatus,
    streamPlaybackUrl,
    streamIframeUrl,
    streamHlsUrl,
  };
}
