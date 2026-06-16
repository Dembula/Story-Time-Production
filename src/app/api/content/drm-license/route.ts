import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";

export async function POST(req: NextRequest) {
  const config = getServerCaptureProtectionConfig();
  if (!config.enabled || !config.drmLicenseUrl) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "SUBSCRIBER") {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (config.drmAuthToken) {
    headers.Authorization = `Bearer ${config.drmAuthToken}`;
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
  return new NextResponse(license, {
    status: 200,
    headers: { "Content-Type": "application/octet-stream" },
  });
}
