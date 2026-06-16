import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUpstreamLicenseTarget } from "@/lib/playback/drm-config";
import { getViewerPlaybackState } from "@/lib/viewer-access";

export const runtime = "nodejs";

/**
 * FairPlay Streaming Key Context (CKC) license proxy.
 *
 * Apple's FairPlay flow:
 *   1. Client fetches the application certificate (GET /certificate).
 *   2. Client generates a Server Playback Context (SPC) blob.
 *   3. Client POSTs SPC to this route — we attach an auth token and
 *      forward to the operator's FPS key server.
 *   4. Upstream returns the Content Key Context (CKC) which the client
 *      surrenders to AVFoundation so the CDM can decrypt frames.
 *
 * Authorisation gates:
 *   - authenticated viewer
 *   - viewer must have entitlement to the requested content
 *   - per-IP rate limit
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentId =
    req.nextUrl.searchParams.get("c")?.split(":")[0]?.trim() ||
    req.headers.get("x-storytime-content")?.split(":")[0]?.trim() ||
    "";
  if (!contentId) {
    return NextResponse.json({ error: "Missing content scope" }, { status: 400 });
  }

  const rl = checkRateLimit({
    key: `fp-lic:${userId}`,
    ip: req.headers.get("x-forwarded-for"),
    maxAttempts: 240,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const content = await prisma.content.findFirst({
    where: { id: contentId, published: true },
    select: { id: true },
  });
  if (!content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const playback = await getViewerPlaybackState(userId, content.id);
  if (!playback.canPlayContent) {
    return NextResponse.json({ error: "Not entitled" }, { status: 403 });
  }

  const target = resolveUpstreamLicenseTarget("com.apple.fps");
  if (!target.url) {
    return NextResponse.json(
      { error: "FairPlay license server not configured" },
      { status: 404 },
    );
  }

  const spc = await req.arrayBuffer();
  if (!spc.byteLength) {
    return NextResponse.json({ error: "Missing SPC payload" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Storytime-User": userId,
    "X-Storytime-Content": content.id,
  };
  if (target.authToken) headers.Authorization = `Bearer ${target.authToken}`;

  try {
    const upstream = await fetch(target.url, {
      method: "POST",
      headers,
      body: spc,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: detail || "FairPlay license request failed" },
        { status: upstream.status },
      );
    }

    const ckc = await upstream.arrayBuffer();
    return new NextResponse(ckc, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (err) {
    console.error("FairPlay license proxy error:", err);
    return NextResponse.json({ error: "License request failed" }, { status: 500 });
  }
}
