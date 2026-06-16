import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveDrmEndpoints, getDrmUpstreamLicenseUrl, type DrmSystem } from "@/lib/playback/drm";

export const runtime = "nodejs";

/**
 * Legacy single-system DRM license proxy (back-compat). Prefer the per-system route
 * at `/api/content/drm-license/[system]`. Defaults to Widevine when no system is set.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = (req.nextUrl.searchParams.get("system") ?? "widevine").toLowerCase();
  const allowed: DrmSystem[] = ["widevine", "playready", "fairplay"];
  if (!(allowed as string[]).includes(requested)) {
    return NextResponse.json({ error: "Unsupported DRM system" }, { status: 400 });
  }
  const system = requested as DrmSystem;

  const videoUrl = req.nextUrl.searchParams.get("videoUrl")?.trim() ?? null;
  const summary = resolveDrmEndpoints(videoUrl);
  if (!summary.enabled) {
    return NextResponse.json({ error: "DRM is not enabled" }, { status: 404 });
  }

  const upstream = getDrmUpstreamLicenseUrl(summary, system);
  if (!upstream) {
    return NextResponse.json({ error: `${system} not configured` }, { status: 404 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
  };
  if (summary.authToken) headers.Authorization = `Bearer ${summary.authToken}`;
  headers["X-Storytime-User"] = session.user.id;

  let licenseRes: Response;
  try {
    licenseRes = await fetch(upstream, { method: "POST", headers, body, cache: "no-store" });
  } catch (err) {
    console.error("DRM license proxy failed:", err);
    return NextResponse.json({ error: "License upstream unreachable" }, { status: 502 });
  }

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
    headers: {
      "Content-Type": licenseRes.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
