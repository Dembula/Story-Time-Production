import { NextRequest, NextResponse } from "next/server";
import { reconcileStuckStreamAssets } from "@/lib/playback/stream-reconciler";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reconcile any `StreamAsset` rows whose Cloudflare webhook never arrived.
 * Called by Vercel Cron (`CRON_SECRET`) or any other scheduler.
 *
 * Behaviour mirrors Netflix/Prime's ingest pipelines: webhooks are best
 * effort; the source of truth is the asset's status read directly from the
 * delivery network. We re-pull every 5 minutes for rows older than 5
 * minutes and younger than 12 hours.
 */
function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileStuckStreamAssets({ maxRows: 75 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("playback reconcile cron failed:", err);
    return NextResponse.json({ ok: false, error: "reconcile failed" }, { status: 500 });
  }
}
