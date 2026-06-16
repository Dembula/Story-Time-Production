import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveDrmEndpoints } from "@/lib/playback/drm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoUrl = req.nextUrl.searchParams.get("videoUrl")?.trim() ?? null;
  const summary = resolveDrmEndpoints(videoUrl);
  const certUrl = summary.endpoints.fairplay?.certUrl ?? null;
  if (!certUrl) {
    return NextResponse.json({ error: "FairPlay cert not configured" }, { status: 404 });
  }

  let certRes: Response;
  try {
    certRes = await fetch(certUrl, { cache: "no-store" });
  } catch (err) {
    console.error("FairPlay cert proxy failed:", err);
    return NextResponse.json({ error: "Cert upstream unreachable" }, { status: 502 });
  }

  if (!certRes.ok) {
    const detail = await certRes.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "Cert request failed" },
      { status: certRes.status },
    );
  }

  const body = await certRes.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": certRes.headers.get("content-type") ?? "application/octet-stream",
      // FairPlay certs rotate slowly; short cache is fine but always go through the proxy.
      "Cache-Control": "private, max-age=300",
    },
  });
}
