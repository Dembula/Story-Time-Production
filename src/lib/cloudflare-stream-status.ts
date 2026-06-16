import {
  buildCloudflarePlaybackUrls,
  getCloudflareStreamConfig,
} from "@/lib/cloudflare-stream";
import {
  listPendingStreamAssets,
  upsertStreamAsset,
} from "@/lib/stream-asset-store";
import { syncLinkedEntitiesAfterStreamReady } from "@/lib/stream-entity-sync";

export type CloudflareStreamStatus = {
  uid: string;
  state: string;
  readyToStream: boolean;
  durationSeconds: number | null;
  errorReasonCode: string | null;
  errorReasonText: string | null;
};

type CloudflareStreamResult = {
  uid?: string;
  readyToStream?: boolean;
  duration?: number;
  status?: {
    state?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
    pctComplete?: string;
  };
};

/** Fetch the current processing status of a single Cloudflare Stream video. */
export async function fetchCloudflareStreamStatus(
  uid: string,
): Promise<CloudflareStreamStatus | null> {
  const cfg = getCloudflareStreamConfig();
  if (!cfg) return null;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream/${uid}`,
    {
      headers: { Authorization: `Bearer ${cfg.apiToken}` },
      cache: "no-store",
    },
  );

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: CloudflareStreamResult;
    errors?: Array<{ message?: string }>;
  };

  if (!res.ok || !payload.success || !payload.result) {
    return null;
  }

  const result = payload.result;
  return {
    uid: result.uid ?? uid,
    state: result.status?.state ?? "unknown",
    readyToStream: Boolean(result.readyToStream),
    durationSeconds:
      typeof result.duration === "number" && result.duration > 0 ? Math.round(result.duration) : null,
    errorReasonCode: result.status?.errorReasonCode ?? null,
    errorReasonText: result.status?.errorReasonText ?? null,
  };
}

/**
 * Poll Cloudflare for one asset and persist the latest status. When the video
 * becomes ready, linked catalogue rows are pointed at the Stream playback URLs.
 * This is the resilient counterpart to the webhook — it runs on demand (during a
 * playback request) and on a schedule (cron) so a missed webhook never leaves a
 * title stuck in "processing".
 */
export async function reconcileStreamAsset(uid: string): Promise<CloudflareStreamStatus | null> {
  const status = await fetchCloudflareStreamStatus(uid);
  if (!status) return null;

  const cfg = getCloudflareStreamConfig();
  const urls = cfg ? buildCloudflarePlaybackUrls(uid, cfg.customerSubdomain) : null;
  const errorText = status.errorReasonText || status.errorReasonCode || null;

  await upsertStreamAsset({
    uid,
    status: status.state,
    hlsUrl: urls?.hlsUrl ?? null,
    playbackUrl: urls?.mp4Url ?? null,
    iframeUrl: urls?.iframeUrl ?? null,
    lastError: errorText,
  });

  if (status.readyToStream || status.state.toLowerCase() === "ready") {
    try {
      await syncLinkedEntitiesAfterStreamReady(uid, "ready");
    } catch (err) {
      console.error("Stream reconcile entity sync failed:", err);
    }
  }

  return status;
}

/** Reconcile every non-terminal asset (scheduled job). Returns a summary. */
export async function reconcilePendingStreamAssets(
  limit = 50,
): Promise<{ checked: number; ready: number; errored: number }> {
  const pending = await listPendingStreamAssets(limit);
  let ready = 0;
  let errored = 0;

  for (const asset of pending) {
    try {
      const status = await reconcileStreamAsset(asset.uid);
      if (!status) continue;
      if (status.readyToStream || status.state.toLowerCase() === "ready") ready += 1;
      if (status.state.toLowerCase() === "error") errored += 1;
    } catch (err) {
      console.error(`Failed to reconcile stream asset ${asset.uid}:`, err);
    }
  }

  return { checked: pending.length, ready, errored };
}
