import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma";
import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";

export async function upsertStreamAsset(input: {
  uid: string;
  sourceUrl?: string | null;
  playbackUrl?: string | null;
  hlsUrl?: string | null;
  iframeUrl?: string | null;
  status?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  lastError?: string | null;
  lastWebhookAt?: Date | null;
}) {
  const id = `sa_${crypto.randomUUID().replace(/-/g, "")}`;
  await prisma.$executeRaw`
    INSERT INTO "StreamAsset" (
      "id","uid","sourceUrl","playbackUrl","hlsUrl","iframeUrl","status",
      "entityType","entityId","lastError","lastWebhookAt","createdAt","updatedAt"
    ) VALUES (
      ${id},
      ${input.uid},
      ${input.sourceUrl ?? null},
      ${input.playbackUrl ?? null},
      ${input.hlsUrl ?? null},
      ${input.iframeUrl ?? null},
      ${input.status ?? "queued"},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${input.lastError ?? null},
      ${input.lastWebhookAt ?? null},
      now(),
      now()
    )
    ON CONFLICT ("uid") DO UPDATE SET
      "sourceUrl" = COALESCE(EXCLUDED."sourceUrl","StreamAsset"."sourceUrl"),
      "playbackUrl" = COALESCE(EXCLUDED."playbackUrl","StreamAsset"."playbackUrl"),
      "hlsUrl" = COALESCE(EXCLUDED."hlsUrl","StreamAsset"."hlsUrl"),
      "iframeUrl" = COALESCE(EXCLUDED."iframeUrl","StreamAsset"."iframeUrl"),
      "status" = COALESCE(EXCLUDED."status","StreamAsset"."status"),
      "entityType" = COALESCE(EXCLUDED."entityType","StreamAsset"."entityType"),
      "entityId" = COALESCE(EXCLUDED."entityId","StreamAsset"."entityId"),
      "lastError" = COALESCE(EXCLUDED."lastError","StreamAsset"."lastError"),
      "lastWebhookAt" = COALESCE(EXCLUDED."lastWebhookAt","StreamAsset"."lastWebhookAt"),
      "updatedAt" = now()
  `;
}

export async function setStreamAssetEntity(uid: string, entityType: string, entityId: string) {
  await prisma.$executeRaw`
    UPDATE "StreamAsset"
    SET "entityType" = ${entityType}, "entityId" = ${entityId}, "updatedAt" = now()
    WHERE "uid" = ${uid}
  `;
}

export async function findStreamAssetUidBySourceUrl(sourceUrl: string): Promise<string | null> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) return null;
  const rows = (await prisma.$queryRaw`
    SELECT "uid"
    FROM "StreamAsset"
    WHERE "sourceUrl" = ${trimmed}
    LIMIT 1
  `) as Array<{ uid: string }>;
  return rows[0]?.uid ?? null;
}

export type StreamAssetPlaybackCandidate = {
  uid: string;
  sourceUrl: string | null;
  status: string | null;
  playbackUrl: string | null;
  hlsUrl: string | null;
  iframeUrl: string | null;
};

export async function findStreamAssetBySourceUrl(
  sourceUrl: string,
): Promise<StreamAssetPlaybackCandidate | null> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) return null;
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "status", "playbackUrl", "hlsUrl", "iframeUrl"
    FROM "StreamAsset"
    WHERE "sourceUrl" = ${trimmed}
    LIMIT 1
  `) as StreamAssetPlaybackCandidate[];
  return rows[0] ?? null;
}

export async function getStreamAssetsByUrls(
  urls: Array<string | null | undefined>,
): Promise<Map<string, StreamAssetPlaybackCandidate>> {
  const normalized = [...new Set(urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url)))];
  const result = new Map<string, StreamAssetPlaybackCandidate>();
  if (normalized.length === 0) return result;

  const uids = [...new Set(normalized.map((url) => extractCloudflareStreamUid(url)).filter((uid): uid is string => Boolean(uid)))];
  const rowsByUid = new Map<string, StreamAssetPlaybackCandidate>();
  if (uids.length > 0) {
    const rows = (await prisma.$queryRaw`
      SELECT "uid", "sourceUrl", "status", "playbackUrl", "hlsUrl", "iframeUrl"
      FROM "StreamAsset"
      WHERE "uid" IN (${Prisma.join(uids)})
    `) as StreamAssetPlaybackCandidate[];
    for (const row of rows) rowsByUid.set(row.uid, row);
  }

  const rowsBySource = new Map<string, StreamAssetPlaybackCandidate>();
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "status", "playbackUrl", "hlsUrl", "iframeUrl"
    FROM "StreamAsset"
    WHERE "sourceUrl" IN (${Prisma.join(normalized)})
  `) as StreamAssetPlaybackCandidate[];
  for (const row of rows) {
    if (row.sourceUrl) rowsBySource.set(row.sourceUrl, row);
  }

  for (const url of normalized) {
    const uid = extractCloudflareStreamUid(url);
    const asset = (uid ? rowsByUid.get(uid) : null) ?? rowsBySource.get(url);
    if (asset) result.set(url, asset);
  }
  return result;
}

export type PendingStreamAsset = {
  uid: string;
  sourceUrl: string | null;
  status: string | null;
  entityType: string | null;
  entityId: string | null;
};

/**
 * Assets that have not reached a terminal "ready" state yet — used by the
 * reconciliation job so playback becomes available even if a webhook was missed.
 */
export async function listPendingStreamAssets(limit = 50): Promise<PendingStreamAsset[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "status", "entityType", "entityId"
    FROM "StreamAsset"
    WHERE LOWER(COALESCE("status", '')) NOT IN ('ready', 'error', 'failed')
    ORDER BY "updatedAt" ASC
    LIMIT ${safeLimit}
  `) as PendingStreamAsset[];
  return rows;
}

export async function getStreamStatusesByUids(uids: string[]) {
  if (uids.length === 0) return new Map<string, { status: string | null; playbackUrl: string | null }>();
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "status", "playbackUrl"
    FROM "StreamAsset"
    WHERE "uid" IN (${Prisma.join(uids)})
  `) as Array<{ uid: string; status: string | null; playbackUrl: string | null }>;
  return new Map(rows.map((r) => [r.uid, { status: r.status, playbackUrl: r.playbackUrl }]));
}

