import { NextRequest, NextResponse } from "next/server";
import { upsertStreamAsset } from "@/lib/stream-asset-store";

function extractHeaderSecret(req: NextRequest): string | null {
  return (
    req.headers.get("x-stream-webhook-secret") ??
    req.headers.get("webhook-secret") ??
    req.headers.get("x-webhook-secret")
  );
}

function pickStatus(payload: any): string {
  return (
    payload?.status?.state ??
    payload?.status ??
    payload?.result?.status?.state ??
    payload?.result?.status ??
    "unknown"
  );
}

function pickUid(payload: any): string | null {
  return payload?.uid ?? payload?.result?.uid ?? null;
}

export async function POST(req: NextRequest) {
  const expected = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  if (expected) {
    const provided = extractHeaderSecret(req)?.trim();
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const uid = pickUid(payload);
  if (!uid) return NextResponse.json({ error: "Missing stream uid" }, { status: 400 });

  const state = pickStatus(payload);
  const errorMessage =
    payload?.error ?? payload?.errors?.[0]?.message ?? payload?.result?.error ?? null;

  await upsertStreamAsset({
    uid,
    status: state,
    lastError: errorMessage ? String(errorMessage) : null,
    lastWebhookAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}

