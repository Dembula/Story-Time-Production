import { NextResponse } from "next/server";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";

export async function GET() {
  const config = getServerCaptureProtectionConfig();
  const certificateUrl = config.multiDrm.fairplayCertificateUrl;
  if (!config.enabled || !certificateUrl) {
    return NextResponse.json({ error: "FairPlay certificate not configured" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  if (config.drmAuthToken) {
    headers.Authorization = `Bearer ${config.drmAuthToken}`;
  }

  const certificateRes = await fetch(certificateUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!certificateRes.ok) {
    const detail = await certificateRes.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "Certificate request failed" },
      { status: certificateRes.status },
    );
  }

  const cert = await certificateRes.arrayBuffer();
  return new NextResponse(cert, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" },
  });
}
