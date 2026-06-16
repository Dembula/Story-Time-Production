import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveDrmEndpoints, getDrmUpstreamLicenseUrl, type DrmSystem } from "@/lib/playback/drm";

export const runtime = "nodejs";

const ALLOWED_SYSTEMS: DrmSystem[] = ["fairplay", "widevine", "playready"];

function parseSystem(value: string | undefined): DrmSystem | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return (ALLOWED_SYSTEMS as string[]).includes(normalized) ? (normalized as DrmSystem) : null;
}

function contentTypeForSystem(system: DrmSystem): string {
  switch (system) {
    case "playready":
      return "text/xml; charset=utf-8";
    case "fairplay":
    case "widevine":
    default:
      return "application/octet-stream";
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ system: string }> },
) {
  const { system: raw } = await params;
  const system = parseSystem(raw);
  if (!system) {
    return NextResponse.json({ error: "Unsupported DRM system" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentId = req.nextUrl.searchParams.get("contentId")?.trim() ?? null;
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
    "Content-Type": req.headers.get("content-type") ?? contentTypeForSystem(system),
  };
  if (system === "playready") {
    headers.SOAPAction = req.headers.get("soapaction") ?? '"http://schemas.microsoft.com/DRM/2007/03/protocols/AcquireLicense"';
  }
  if (summary.authToken) {
    headers.Authorization = `Bearer ${summary.authToken}`;
  }
  if (contentId) {
    headers["X-Storytime-Content"] = contentId;
  }
  headers["X-Storytime-User"] = session.user.id;

  let licenseRes: Response;
  try {
    licenseRes = await fetch(upstream, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    console.error(`DRM ${system} license proxy failed:`, err);
    return NextResponse.json({ error: "License upstream unreachable" }, { status: 502 });
  }

  if (!licenseRes.ok) {
    const detail = await licenseRes.text().catch(() => "");
    console.error(`DRM ${system} license error ${licenseRes.status}:`, detail);
    return NextResponse.json(
      { error: detail || "License request failed" },
      { status: licenseRes.status },
    );
  }

  const license = await licenseRes.arrayBuffer();
  return new NextResponse(license, {
    status: 200,
    headers: {
      "Content-Type": licenseRes.headers.get("content-type") ?? contentTypeForSystem(system),
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
