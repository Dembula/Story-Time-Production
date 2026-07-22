import { NextRequest, NextResponse } from "next/server";
import { buildCloudflarePlaybackUrls, getCloudflareStreamConfig } from "@/lib/cloudflare-stream";
import { upsertStreamAsset } from "@/lib/stream-asset-store";
import { syncLinkedEntitiesAfterStreamReady } from "@/lib/stream-entity-sync";
import {
  isLegacyWebhookSecretHeaderMatch,
  verifyCloudflareStreamWebhookSignature,
} from "@/lib/cloudflare-stream-webhook";

function pickStatus(payload: Record<string, unknown>): string {
  const status = payload.status;
  if (status && typeof status === "object" && "state" in status) {
    return String((status as { state?: unknown }).state ?? "unknown");
  }
  if (typeof status === "string") return status;
  const result = payload.result;
  if (result && typeof result === "object" && "status" in result) {
    const rs = (result as { status?: unknown }).status;
    if (rs && typeof rs === "object" && "state" in rs) {
      return String((rs as { state?: unknown }).state ?? "unknown");
    }
  }
  return "unknown";
}

function pickUid(payload: Record<string, unknown>): string | null {
  if (typeof payload.uid === "string") return payload.uid;
  const result = payload.result;
  if (result && typeof result === "object" && typeof (result as { uid?: string }).uid === "string") {
    return (result as { uid: string }).uid;
  }
  return null;
}

function webhookAuthorized(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  // Cloudflare Stream VOD: HMAC in Webhook-Signature (official)
  const signature =
    req.headers.get("Webhook-Signature") ?? req.headers.get("webhook-signature");
  if (signature && verifyCloudflareStreamWebhookSignature(rawBody, signature, secret)) {
    return true;
  }

  // Legacy manual header (optional dev / custom proxies)
  if (isLegacyWebhookSecretHeaderMatch(req, secret)) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!webhookAuthorized(req, rawBody)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const uid = pickUid(payload);
  if (!uid) return NextResponse.json({ error: "Missing stream uid" }, { status: 400 });

  const state = pickStatus(payload);
  const errorMessage =
    payload.error ??
    (Array.isArray(payload.errors) ? payload.errors[0] : null) ??
    (payload.result && typeof payload.result === "object"
      ? (payload.result as { error?: unknown }).error
      : null);

  const cfg = getCloudflareStreamConfig();
  const urls = cfg ? buildCloudflarePlaybackUrls(uid, cfg.customerSubdomain) : null;

  await upsertStreamAsset({
    uid,
    status: state,
    hlsUrl: urls?.hlsUrl ?? null,
    playbackUrl: urls?.mp4Url ?? null,
    iframeUrl: urls?.iframeUrl ?? null,
    lastError: errorMessage ? String(errorMessage) : null,
    lastWebhookAt: new Date(),
  });

  const failed =
    state.toLowerCase() === "error" ||
    state.toLowerCase() === "failed";
  if (failed && errorMessage) {
    try {
      const { findStreamAssetByUid } = await import("@/lib/stream-asset-store");
      const { isCloudflareBitrateRejectError } = await import("@/lib/stream-input-limits");
      const { recoverFromStreamBitrateFailure } = await import("@/lib/stream-encode-pipeline");
      const asset = await findStreamAssetByUid(uid);
      const errText = String(errorMessage);
      if (asset?.sourceUrl && isCloudflareBitrateRejectError(errText)) {
        await recoverFromStreamBitrateFailure({
          sourceUrl: asset.sourceUrl,
          lastError: errText,
        });
      }
    } catch (recoverErr) {
      console.error("Stream bitrate recovery failed:", recoverErr);
    }
  }

  try {
    await syncLinkedEntitiesAfterStreamReady(uid, state);
  } catch (syncErr) {
    console.error("Stream webhook entity sync failed:", syncErr);
  }

  return NextResponse.json({ ok: true });
}
