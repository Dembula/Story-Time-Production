import { NextRequest, NextResponse } from "next/server";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";

export async function POST(req: NextRequest) {
  const config = getServerCaptureProtectionConfig();
  const requestedSystem = req.nextUrl.searchParams.get("system");
  const drmSystem =
    requestedSystem === "widevine" || requestedSystem === "playready" || requestedSystem === "fairplay"
      ? requestedSystem
      : null;

  const licenseUrl =
    drmSystem === "widevine"
      ? config.multiDrm.widevineLicenseUrl ?? config.drmLicenseUrl
      : drmSystem === "playready"
        ? config.multiDrm.playreadyLicenseUrl ?? config.drmLicenseUrl
        : drmSystem === "fairplay"
          ? config.multiDrm.fairplayLicenseUrl ?? config.drmLicenseUrl
          : config.drmLicenseUrl;

  if (!config.enabled || !licenseUrl) {
    return NextResponse.json({ error: "DRM not configured" }, { status: 404 });
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) {
    return NextResponse.json({ error: "Missing license challenge" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
  };
  if (drmSystem) {
    headers["x-drm-system"] = drmSystem;
  }
  if (config.drmAuthToken) {
    headers.Authorization = `Bearer ${config.drmAuthToken}`;
  }

  const licenseRes = await fetch(licenseUrl, {
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
