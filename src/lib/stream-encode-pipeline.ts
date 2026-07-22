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

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("MediaConvert mezzanine start failed:", err);
    return markFailed(
      input,
      `Auto-compress (MediaConvert) failed: ${message}. Check MEDIACONVERT_ROLE_ARN, IAM PassRole, and that the uploader user can call mediaconvert:CreateJob.`,
    );
  }
}

async function scheduleMezzanineAdvance(placeholderUid: string): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(async () => {
      // Hobby cron is daily — poll here, but slowly to avoid MediaConvert "Too Many Requests".
      for (let i = 0; i < 12; i += 1) {
        await new Promise((r) => setTimeout(r, 45_000));
        try {
          const result = await advanceMezzaninePlaceholder(placeholderUid);
          if (result !== "pending") return;
        } catch (err) {
          console.error("Mezzanine advance poll failed:", err);
        }
      }
    });
  } catch {
    // outside a Next request context — daily cron / admin approve will advance
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
 * 1) Known-safe bitrate → Cloudflare Stream copy
 * 2) High bitrate OR unknown bitrate (when MediaConvert is configured) → mezzanine first
 * 3) Stream bitrate reject → mezzanine recovery
 *
 * Critical: never send unknown-bitrate masters to Stream when MediaConvert is on —
 * browser metadata often fails on ProRes/MOV, which previously skipped compress and
 * hit Cloudflare's 200 Mbps hard limit.
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

  const mcConfigured = isMediaConvertMezzanineConfigured();
  const bitrate = await resolveBitrateMbps(input);
  const knownSafe =
    typeof bitrate === "number" && Number.isFinite(bitrate) && !isOverStreamBitrateLimit(bitrate);

  // Only skip mezzanine when we positively know the master is under Stream's limit.
  const needsMezzanine =
    Boolean(input.forceMezzanine) ||
    isOverStreamBitrateLimit(bitrate) ||
    (mcConfigured && !knownSafe);

  if (needsMezzanine) {
    console.info("encode-pipeline: routing to MediaConvert mezzanine", {
      source: input.catalogueSourceUrl.slice(0, 120),
      bitrate,
      force: Boolean(input.forceMezzanine),
      knownSafe,
      mcConfigured,
    });
    return startMezzanine(input);
  }

  const signedOrPublic =
    (await resolveIngestSourceUrlForCloudflare(input.storageRef || input.catalogueSourceUrl)) ??
    input.catalogueSourceUrl;

  try {
    return await ingestDirectToStream(input, signedOrPublic);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isCloudflareBitrateRejectError(message) || /bitrate|200\s*mbps|uncompress/i.test(message)) {
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
  /** When true, replace a stuck mezzanining placeholder with a fresh MediaConvert job. */
  forceRestart?: boolean;
}): Promise<StreamAssetPlaybackCandidate | null> {
  if (options.lastError && !isCloudflareBitrateRejectError(options.lastError) && !/bitrate/i.test(options.lastError)) {
    return null;
  }

  const existing = await findStreamAssetBySourceUrl(options.sourceUrl);
  if (existing?.status?.toLowerCase() === "mezzanining" && isMediaConvertPlaceholderUid(existing.uid)) {
    if (!options.forceRestart) {
      const advanced = await advanceMezzaninePlaceholder(existing.uid);
      if (advanced === "pending" || advanced === "ready") {
        return (await findStreamAssetBySourceUrl(options.sourceUrl)) ?? existing;
      }
      // Job missing / failed — fall through and create a new MediaConvert job.
    }
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$executeRaw`DELETE FROM "StreamAsset" WHERE "uid" = ${existing.uid}`;
    } catch (err) {
      console.error("Failed to clear stuck mezzanine placeholder:", err);
    }
  }

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

  const { prisma } = await import("@/lib/prisma");
  const placeholderRows = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "entityType", "entityId"
    FROM "StreamAsset"
    WHERE "uid" = ${placeholderUid}
    LIMIT 1
  `) as Array<{
    uid: string;
    sourceUrl: string | null;
    entityType: string | null;
    entityId: string | null;
  }>;
  const placeholder = placeholderRows[0] ?? null;

  const polled = await pollStreamMezzanineJob(jobId);
  if (polled.status === "PROGRESSING" || polled.status === "SUBMITTED" || polled.status === "UNKNOWN") {
    await upsertStreamAsset({
      uid: placeholderUid,
      sourceUrl: placeholder?.sourceUrl ?? undefined,
      status: "mezzanining",
      entityType: placeholder?.entityType ?? undefined,
      entityId: placeholder?.entityId ?? undefined,
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
      sourceUrl: placeholder?.sourceUrl ?? undefined,
      status: "error",
      lastError: polled.message,
    });
    return "error";
  }

  if (polled.status !== "COMPLETE") {
    return "pending";
  }

  const { outputS3Uri, meta } = polled;
  const catalogueSourceUrl =
    cleanNonEmpty(meta.sourceUrl) ||
    cleanNonEmpty(placeholder?.sourceUrl) ||
    cleanNonEmpty(meta.storageRef);
  if (!catalogueSourceUrl) {
    await upsertStreamAsset({
      uid: placeholderUid,
      status: "error",
      lastError:
        "Mezzanine finished but catalogue sourceUrl was missing on the job and placeholder. Restart compress from Encode health.",
    });
    return "error";
  }

  const entityType = meta.entityType ?? placeholder?.entityType ?? null;
  const entityId = meta.entityId ?? placeholder?.entityId ?? null;

  const mezzRef = resolveStorageObjectRef(outputS3Uri);
  const mezzStorageRef = mezzRef ? buildStorageRef(mezzRef.bucket, mezzRef.key) : outputS3Uri;
  const ingestUrl =
    (await resolveIngestSourceUrlForCloudflare(mezzStorageRef)) ??
    (await resolveIngestSourceUrlForCloudflare(outputS3Uri));

  if (!ingestUrl) {
    await upsertStreamAsset({
      uid: placeholderUid,
      sourceUrl: catalogueSourceUrl,
      status: "error",
      lastError: `Mezzanine finished but could not build a signed URL for Stream ingest (${outputS3Uri}).`,
    });
    return "error";
  }

  const stream = await ingestToCloudflareStreamFromUrl(
    ingestUrl,
    buildStreamIngestMeta({
      fileName: meta.fileName ?? "mezzanine.mp4",
      mime: "video/mp4",
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
      creatorId: meta.creatorId ?? undefined,
      source: "storytime-mezzanine",
      area: "mezzanine",
    }),
  );

  // Keep catalogue sourceUrl on the original master; Stream encodes from mezzanine.
  await upsertStreamAsset({
    uid: stream.uid,
    sourceUrl: catalogueSourceUrl,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
    status: stream.state,
    entityType,
    entityId,
    lastError: null,
  });

  if (entityType && entityId) {
    await setStreamAssetEntity(stream.uid, entityType, entityId);
  }

  // Drop placeholder so lookups prefer the real Stream asset.
  try {
    await prisma.$executeRaw`DELETE FROM "StreamAsset" WHERE "uid" = ${placeholderUid}`;
  } catch (err) {
    console.error("Failed to delete mezzanine placeholder asset:", err);
  }

  return "ready";
}

function cleanNonEmpty(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
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
    await new Promise((r) => setTimeout(r, 500));
  }
  return { checked: rows.length, advanced };
}
