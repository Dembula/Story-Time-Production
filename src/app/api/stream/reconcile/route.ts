import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { reconcilePendingStreamAssets, reconcileStreamAsset } from "@/lib/cloudflare-stream-status";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

/**
 * Reconcile Cloudflare Stream processing status. Runs as a scheduled cron job
 * (Bearer CRON_SECRET) or on-demand by an admin. Keeps the catalogue self-healing
 * even when a webhook is missed.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

  try {
    const summary = await reconcilePendingStreamAssets(limit);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("Stream reconcile failed:", err);
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 });
  }
}

/** Reconcile a single asset by uid (admin or cron). */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronCall(request) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { uid?: string } | null;
  const uid = body?.uid?.trim();
  if (!uid) {
    return NextResponse.json({ error: "Missing uid" }, { status: 400 });
  }

  try {
    const status = await reconcileStreamAsset(uid);
    if (!status) {
      return NextResponse.json({ error: "Stream not found or not configured" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("Single stream reconcile failed:", err);
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 });
  }
}
