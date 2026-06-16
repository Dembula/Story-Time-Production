import { NextRequest, NextResponse } from "next/server";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";

export async function POST(req: NextRequest) {
  const config = getServerCaptureProtectionConfig();
  if (!config.enabled || !config.drmLicenseUrl) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  if (config.drmAuthToken) {
    headers.Authorization = `Bearer ${config.drmAuthToken}`;
  }

  // FairPlay SPC requests may arrive as application/octet-stream or x-www-form-urlencoded.
  if (contentType.includes("application/x-www-form-urlencoded")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else {
    headers["Content-Type"] = "application/octet-stream";
  }

  const licenseRes = await fetch(config.drmLicenseUrl, {
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
  const responseType = licenseRes.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(license, {
    status: 200,
    headers: { "Content-Type": responseType },
  });
}
