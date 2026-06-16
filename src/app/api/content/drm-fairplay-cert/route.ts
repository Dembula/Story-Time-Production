import { NextResponse } from "next/server";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";

export async function GET() {
  const config = getServerCaptureProtectionConfig();
  if (!config.enabled || !config.fairPlayCertificateUrl) {
    return NextResponse.json({ error: "FairPlay certificate not configured" }, { status: 404 });
  }

  const headers: Record<string, string> = {};
  if (config.drmAuthToken) {
    headers.Authorization = `Bearer ${config.drmAuthToken}`;
  }

  const certificateRes = await fetch(config.fairPlayCertificateUrl, {
    headers,
    cache: "no-store",
  });

  if (!certificateRes.ok) {
    return NextResponse.json({ error: "FairPlay certificate unavailable" }, { status: 502 });
  }

  const certificate = await certificateRes.arrayBuffer();
  return new NextResponse(certificate, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": certificateRes.headers.get("Content-Type") || "application/octet-stream",
    },
  });
}
