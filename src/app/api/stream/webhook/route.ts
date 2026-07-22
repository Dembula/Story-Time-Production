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

function extractWebhookError(payload: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    payload.error,
    payload.errorReason,
    payload.errReason,
    Array.isArray(payload.errors) ? payload.errors[0] : null,
  ];

  const status = payload.status;
  if (status && typeof status === "object") {
    const s = status as Record<string, unknown>;
    candidates.push(s.error, s.errorReason, s.errorReasonText, s.errReason, s.errorCodeMessage);
  }

  const result = payload.result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    candidates.push(r.error);
    if (r.status && typeof r.status === "object") {
      const rs = r.status as Record<string, unknown>;
      candidates.push(rs.error, rs.errorReason, rs.errorReasonText, rs.errReason);
    }
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (c && typeof c === "object" && "message" in c && typeof (c as { message?: unknown }).message === "string") {
      return String((c as { message: string }).message);
    }
  }
  return null;
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
  const errorMessage = extractWebhookError(payload);

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

  const failed = state.toLowerCase() === "error" || state.toLowerCase() === "failed";
  if (failed) {
    try {
      const { findStreamAssetByUid } = await import("@/lib/stream-asset-store");
      const { isCloudflareBitrateRejectError } = await import("@/lib/stream-input-limits");
      const { isMediaConvertMezzanineConfigured } = await import("@/lib/mediaconvert-mezzanine");
      const { recoverFromStreamBitrateFailure } = await import("@/lib/stream-encode-pipeline");
      const asset = await findStreamAssetByUid(uid);
      const errText = errorMessage ? String(errorMessage) : "";
      const bitrateReject = isCloudflareBitrateRejectError(errText) || /bitrate|200\s*mbps|uncompress/i.test(errText);
      // When MediaConvert is on, any failed encode with bitrate-ish text (or empty reason) → mezzanine.
      const shouldMezzanine =
        Boolean(asset?.sourceUrl) &&
        (bitrateReject || (isMediaConvertMezzanineConfigured() && (!errText || bitrateReject)));

      if (shouldMezzanine && asset?.sourceUrl) {
        console.info("stream-webhook: recovering failed encode via MediaConvert mezzanine", {
          uid,
          errText: errText.slice(0, 160),
        });
        await recoverFromStreamBitrateFailure({
          sourceUrl: asset.sourceUrl,
          lastError: errText || "bitrate exceeds 200Mbps",
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
