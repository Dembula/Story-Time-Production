import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveUpstreamLicenseTarget } from "@/lib/playback/drm-config";
import { getViewerPlaybackState } from "@/lib/viewer-access";

export const runtime = "nodejs";

/**
 * Widevine license proxy.
 *
 * Browser / Android workflow (EME):
 *   1. CDM emits a license request blob.
 *   2. Player POSTs the blob to this route.
 *   3. We forward to the operator's license server with an auth token and
 *      a content-scope header (so the server can enforce entitlements,
 *      watermark per-session, and apply geo + concurrent session rules).
 *   4. License response is streamed back as opaque bytes for the CDM.
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
    key: `wv-lic:${userId}`,
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

  const target = resolveUpstreamLicenseTarget("com.widevine.alpha");
  if (!target.url) {
    return NextResponse.json(
      { error: "Widevine license server not configured" },
      { status: 404 },
    );
  }

  const challenge = await req.arrayBuffer();
  if (!challenge.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Storytime-User": userId,
    "X-Storytime-Content": content.id,
  };
  if (target.authToken) headers.Authorization = `Bearer ${target.authToken}`;
  if (target.customDataHeader) {
    const incoming = req.headers.get(target.customDataHeader);
    if (incoming) headers[target.customDataHeader] = incoming;
  }

  try {
    const upstream = await fetch(target.url, {
      method: "POST",
      headers,
      body: challenge,
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: detail || "Widevine license request failed" },
        { status: upstream.status },
      );
    }

    const license = await upstream.arrayBuffer();
    return new NextResponse(license, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (err) {
    console.error("Widevine license proxy error:", err);
    return NextResponse.json({ error: "License request failed" }, { status: 500 });
  }
}
