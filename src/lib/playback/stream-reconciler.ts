import { prisma } from "@/lib/prisma";
import { pollCloudflareStreamStatus } from "@/lib/cloudflare-stream";
import { upsertStreamAsset } from "@/lib/stream-asset-store";
import { syncLinkedEntitiesAfterStreamReady } from "@/lib/stream-entity-sync";

const PROCESSING_STATES = new Set([
  "queued",
  "downloading",
  "inprogress",
  "in_progress",
  "encoding",
  "pendingupload",
  "pending_upload",
  "uploading",
]);

const MAX_AGE_HOURS = 12;

export type StreamReconcileResult = {
  checked: number;
  promoted: number;
  failed: number;
  skipped: number;
};

/**
 * Reconcile `StreamAsset` rows that webhooks may have missed.
 *
 * Webhooks are the primary signal but can drop in flight (provider outage,
 * 5xx from our origin, network blip). This routine catches any row stuck in
 * a processing state for too long and pulls authoritative status from the
 * Cloudflare Stream API, then re-runs the entity sync.
 */
export async function reconcileStuckStreamAssets(options?: {
  maxRows?: number;
}): Promise<StreamReconcileResult> {
  const limit = Math.min(Math.max(options?.maxRows ?? 50, 1), 200);
  const cutoff = new Date(Date.now() - 5 * 60_000);
  const ancient = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60_000);

  const rows = (await prisma.$queryRaw`
    SELECT "uid", "status", "createdAt", "updatedAt"
    FROM "StreamAsset"
    WHERE COALESCE("status", '') NOT IN ('ready', 'failed', 'error')
      AND "updatedAt" < ${cutoff}
      AND "createdAt" > ${ancient}
    ORDER BY "updatedAt" ASC
    LIMIT ${limit}
  `) as Array<{ uid: string; status: string | null }>;

  let promoted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const wasProcessing = PROCESSING_STATES.has((row.status ?? "").toLowerCase());
    const result = await pollCloudflareStreamStatus(row.uid);
    if (!result) {
      skipped += 1;
      continue;
    }

    await upsertStreamAsset({
      uid: row.uid,
      status: result.state,
      lastError: result.errorMessage ?? null,
      lastWebhookAt: new Date(),
    });

    const state = (result.state || "").toLowerCase();
    if (state === "ready") {
      promoted += 1;
      try {
        await syncLinkedEntitiesAfterStreamReady(row.uid, result.state);
      } catch (err) {
        console.error("stream reconcile sync failed:", err);
      }
    } else if (state === "failed" || state === "error") {
      failed += 1;
    } else if (!wasProcessing) {
      skipped += 1;
    }
  }

  return { checked: rows.length, promoted, failed, skipped };
}
