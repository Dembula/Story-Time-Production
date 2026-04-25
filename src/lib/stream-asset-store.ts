import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function getStreamStatusesByUids(uids: string[]) {
  if (uids.length === 0) return new Map<string, { status: string | null; playbackUrl: string | null }>();
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "status", "playbackUrl"
    FROM "StreamAsset"
    WHERE "uid" IN (${Prisma.join(uids)})
  `) as Array<{ uid: string; status: string | null; playbackUrl: string | null }>;
  return new Map(rows.map((r) => [r.uid, { status: r.status, playbackUrl: r.playbackUrl }]));
}

