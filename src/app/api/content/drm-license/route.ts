import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { getDrmProviderConfig } from "@/lib/playback/drm-config";

export const runtime = "nodejs";

/**
 * Legacy single-system license proxy kept for older players that haven't
 * migrated to the per-key-system endpoints (`/api/content/drm/{widevine|
 * playready|fairplay}/license`). Newer clients should target those routes
 * directly so that:
 *   - FairPlay can fetch a proper certificate,
 *   - PlayReady can preserve SOAP semantics,
 *   - entitlement checks are stricter (per-content scope).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit({
    key: `drm-legacy:${session.user.id}`,
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

  const config = getServerCaptureProtectionConfig();
  const drm = getDrmProviderConfig();
  const upstream =
    drm.widevine.upstreamLicenseUrl ??
    drm.legacyLicenseUrl ??
    config.drmLicenseUrl;
  const authToken =
    drm.widevine.authToken ??
    drm.legacyAuthToken ??
    config.drmAuthToken;

  if (!upstream) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "X-Storytime-User": session.user.id,
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const licenseRes = await fetch(upstream, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  if (!licenseRes.ok) {
    const detail = await licenseRes.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "License request failed" },
      { status: licenseRes.status },
    );
  }

  const license = await licenseRes.arrayBuffer();
  return new NextResponse(license, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" },
  });
}
