import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { ingestToCloudflareStreamFromUrl } from "@/lib/cloudflare-stream";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import {
  isMediaConvertMezzanineConfigured,
  isMediaConvertPlaceholderUid,
  mediaConvertJobIdFromPlaceholderUid,
  pollStreamMezzanineJob,
  startStreamMezzanineJob,
} from "@/lib/mediaconvert-mezzanine";
import { buildStreamIngestMeta } from "@/lib/stream-ingest-meta";
import { resolveIngestSourceUrlForCloudflare } from "@/lib/stream-ingest-source";
import {
  bitrateTooHighUserMessage,
  estimateAverageBitrateMbps,
  isCloudflareBitrateRejectError,
  isOverStreamBitrateLimit,
  mezzanineQueuedUserMessage,
} from "@/lib/stream-input-limits";
import {
  deleteFailedStreamAssetsForSourceUrl,
  findStreamAssetBySourceUrl,
  setStreamAssetEntity,
  upsertStreamAsset,
  type StreamAssetPlaybackCandidate,
} from "@/lib/stream-asset-store";
import { resolveStorageObjectRef, buildStorageRef } from "@/lib/storage-object-ref";

export type EncodePipelineInput = {
  catalogueSourceUrl: string;
  storageRef?: string | null;
  contentType?: string | null;
  fileName?: string | null;
  creatorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** From browser probe when available. */
  durationSeconds?: number | null;
  estimatedBitrateMbps?: number | null;
  /** Force mezzanine (e.g. after Stream bitrate reject). */
  forceMezzanine?: boolean;
  meta?: Record<string, string>;
};

async function resolveObjectSizeBytes(storageRefOrUrl: string): Promise<number | null> {
  const ref = resolveStorageObjectRef(storageRefOrUrl);
  if (!ref) return null;
  try {
    const { client } = createContentMediaS3Client();
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key,
      }),
    );
    return typeof head.ContentLength === "number" ? head.ContentLength : null;
  } catch {
    return null;
  }
}

async function resolveBitrateMbps(input: EncodePipelineInput): Promise<number | null> {
  if (typeof input.estimatedBitrateMbps === "number" && Number.isFinite(input.estimatedBitrateMbps)) {
    return input.estimatedBitrateMbps;
  }
  const duration = input.durationSeconds;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0.5) {
    return null;
  }
  const size =
    (await resolveObjectSizeBytes(input.storageRef || input.catalogueSourceUrl)) ??
    (await resolveObjectSizeBytes(input.catalogueSourceUrl));
  if (size == null) return null;
  return estimateAverageBitrateMbps(size, duration);
}

async function markFailed(input: EncodePipelineInput, message: string): Promise<StreamAssetPlaybackCandidate> {
  const uid = `err_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  await upsertStreamAsset({
    uid,
    sourceUrl: input.catalogueSourceUrl,
    status: "error",
    lastError: message,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });
  return {
    uid,
    sourceUrl: input.catalogueSourceUrl,
    status: "error",
    playbackUrl: null,
    hlsUrl: null,
    iframeUrl: null,
  };
}

async function startMezzanine(input: EncodePipelineInput): Promise<StreamAssetPlaybackCandidate> {
  if (!isMediaConvertMezzanineConfigured()) {
    const bitrate = await resolveBitrateMbps(input);
    const message =
      bitrate != null
        ? bitrateTooHighUserMessage(bitrate)
        : bitrateTooHighUserMessage(STREAM_SAFE_FALLBACK_HINT_MBPS);
    return markFailed(input, message);
  }

  const started = await startStreamMezzanineJob({
    sourceUrl: input.catalogueSourceUrl,
    storageRef: input.storageRef,
    entityType: input.entityType,
    entityId: input.entityId,
    creatorId: input.creatorId,
    fileName: input.fileName,
  });

  await upsertStreamAsset({
    uid: started.placeholderUid,
    sourceUrl: input.catalogueSourceUrl,
    status: "mezzanining",
    lastError: mezzanineQueuedUserMessage(),
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });

  // Kick early polls so short jobs finish without waiting on the 5‑minute cron.
  void scheduleMezzanineAdvance(started.placeholderUid);

  return {
    uid: started.placeholderUid,
    sourceUrl: input.catalogueSourceUrl,
    status: "mezzanining",
    playbackUrl: null,
    hlsUrl: null,
    iframeUrl: null,
  };
}

async function scheduleMezzanineAdvance(placeholderUid: string): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(async () => {
      for (let i = 0; i < 8; i += 1) {
        await new Promise((r) => setTimeout(r, 15_000));
        try {
          const result = await advanceMezzaninePlaceholder(placeholderUid);
          if (result !== "pending") return;
        } catch (err) {
          console.error("Mezzanine advance poll failed:", err);
        }
      }
    });
  } catch {
    // outside a Next request context — cron / admin approve will advance
  }
}

const STREAM_SAFE_FALLBACK_HINT_MBPS = 250;

async function ingestDirectToStream(
  input: EncodePipelineInput,
  ingestHttpUrl: string,
): Promise<StreamAssetPlaybackCandidate> {
  const stream = await ingestToCloudflareStreamFromUrl(
    ingestHttpUrl,
    buildStreamIngestMeta({
      ...input.meta,
      fileName: input.fileName ?? input.catalogueSourceUrl.split("/").pop() ?? "video.mp4",
      mime: input.contentType ?? undefined,
      entityType: input.entityType ?? undefined,
      entityId: input.entityId ?? undefined,
      creatorId: input.creatorId ?? undefined,
      source: input.meta?.source ?? "storytime-encode-pipeline",
    }),
  );

  await upsertStreamAsset({
    uid: stream.uid,
    sourceUrl: input.catalogueSourceUrl,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
    status: stream.state,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    lastError: null,
  });

  if (input.entityType && input.entityId) {
    await setStreamAssetEntity(stream.uid, input.entityType, input.entityId);
  }

  return {
    uid: stream.uid,
    sourceUrl: input.catalogueSourceUrl,
    status: stream.state,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
  };
}

/**
 * Encode path for catalogue / upload videos:
 * 1) High bitrate → MediaConvert mezzanine (when configured) then Stream
 * 2) Safe bitrate → Cloudflare Stream copy
 * 3) Bitrate reject recovery → mezzanine
 */
export async function runStreamEncodePipeline(
  input: EncodePipelineInput,
): Promise<StreamAssetPlaybackCandidate | null> {
  await deleteFailedStreamAssetsForSourceUrl(input.catalogueSourceUrl);

  const existing = await findStreamAssetBySourceUrl(input.catalogueSourceUrl);
  if (existing?.status?.toLowerCase() === "mezzanining" && isMediaConvertPlaceholderUid(existing.uid)) {
    void advanceMezzaninePlaceholder(existing.uid).catch((err) =>
      console.error("Mezzanine advance on re-entry failed:", err),
    );
    return existing;
  }

  const bitrate = await resolveBitrateMbps(input);
  const needsMezzanine = Boolean(input.forceMezzanine) || isOverStreamBitrateLimit(bitrate);

  if (needsMezzanine) {
    return startMezzanine(input);
  }

  const signedOrPublic =
    (await resolveIngestSourceUrlForCloudflare(input.storageRef || input.catalogueSourceUrl)) ??
    input.catalogueSourceUrl;

  try {
    return await ingestDirectToStream(input, signedOrPublic);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isCloudflareBitrateRejectError(message) || /bitrate/i.test(message)) {
      return startMezzanine({ ...input, forceMezzanine: true });
    }
    console.error("Stream encode pipeline ingest failed:", err);
    return markFailed(input, message);
  }
}

/** After Cloudflare reports a bitrate rejection, start mezzanine (or mark clearly failed). */
export async function recoverFromStreamBitrateFailure(options: {
  sourceUrl: string;
  lastError?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): Promise<StreamAssetPlaybackCandidate | null> {
  if (!isCloudflareBitrateRejectError(options.lastError) && !options.lastError) {
    // Still allow explicit recovery calls with empty error when admin re-queues.
  }
  if (options.lastError && !isCloudflareBitrateRejectError(options.lastError) && !/bitrate/i.test(options.lastError)) {
    return null;
  }

  const existing = await findStreamAssetBySourceUrl(options.sourceUrl);
  if (existing?.status?.toLowerCase() === "mezzanining") return existing;

  return runStreamEncodePipeline({
    catalogueSourceUrl: options.sourceUrl,
    storageRef: options.sourceUrl,
    entityType: options.entityType ?? null,
    entityId: options.entityId ?? null,
    forceMezzanine: true,
    meta: { source: "storytime-bitrate-recovery" },
  });
}

/**
 * Poll one MediaConvert placeholder asset; on COMPLETE, ingest mezzanine into Stream.
 */
export async function advanceMezzaninePlaceholder(
  placeholderUid: string,
): Promise<"pending" | "ready" | "error"> {
  const jobId = mediaConvertJobIdFromPlaceholderUid(placeholderUid);
  if (!jobId) return "error";

  const polled = await pollStreamMezzanineJob(jobId);
  if (polled.status === "PROGRESSING" || polled.status === "SUBMITTED" || polled.status === "UNKNOWN") {
    await upsertStreamAsset({
      uid: placeholderUid,
      status: "mezzanining",
      lastError:
        typeof polled.progress === "number"
          ? `Compressing mezzanine… ${Math.round(polled.progress)}%`
          : mezzanineQueuedUserMessage(),
    });
    return "pending";
  }

  if (polled.status === "ERROR") {
    await upsertStreamAsset({
      uid: placeholderUid,
      status: "error",
      lastError: polled.message,
    });
    return "error";
  }

  if (polled.status !== "COMPLETE") {
    return "pending";
  }

  const { outputS3Uri, meta } = polled;
  const mezzRef = resolveStorageObjectRef(outputS3Uri);
  const mezzStorageRef = mezzRef ? buildStorageRef(mezzRef.bucket, mezzRef.key) : outputS3Uri;
  const ingestUrl =
    (await resolveIngestSourceUrlForCloudflare(mezzStorageRef)) ??
    (await resolveIngestSourceUrlForCloudflare(outputS3Uri));

  if (!ingestUrl) {
    await upsertStreamAsset({
      uid: placeholderUid,
      status: "error",
      lastError: "Mezzanine finished but could not build a signed URL for Stream ingest.",
    });
    return "error";
  }

  const stream = await ingestToCloudflareStreamFromUrl(
    ingestUrl,
    buildStreamIngestMeta({
      fileName: meta.fileName ?? "mezzanine.mp4",
      mime: "video/mp4",
      entityType: meta.entityType ?? undefined,
      entityId: meta.entityId ?? undefined,
      creatorId: meta.creatorId ?? undefined,
      source: "storytime-mezzanine",
      area: "mezzanine",
    }),
  );

  // Keep catalogue sourceUrl on the original master; Stream encodes from mezzanine.
  await upsertStreamAsset({
    uid: stream.uid,
    sourceUrl: meta.sourceUrl,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
    status: stream.state,
    entityType: meta.entityType ?? null,
    entityId: meta.entityId ?? null,
    lastError: null,
  });

  if (meta.entityType && meta.entityId) {
    await setStreamAssetEntity(stream.uid, meta.entityType, meta.entityId);
  }

  // Drop placeholder so lookups prefer the real Stream asset.
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRaw`DELETE FROM "StreamAsset" WHERE "uid" = ${placeholderUid}`;
  } catch (err) {
    console.error("Failed to delete mezzanine placeholder asset:", err);
  }

  return "ready";
}

export async function advanceAllMezzanineJobs(limit = 20): Promise<{ checked: number; advanced: number }> {
  const { prisma } = await import("@/lib/prisma");
  const rows = (await prisma.$queryRaw`
    SELECT "uid"
    FROM "StreamAsset"
    WHERE "status" = 'mezzanining'
      AND "uid" LIKE 'mc_%'
    ORDER BY "updatedAt" ASC
    LIMIT ${limit}
  `) as Array<{ uid: string }>;

  let advanced = 0;
  for (const row of rows) {
    const result = await advanceMezzaninePlaceholder(row.uid);
    if (result !== "pending") advanced += 1;
  }
  return { checked: rows.length, advanced };
}
