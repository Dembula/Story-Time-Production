import { NextResponse } from "next/server";
import { getServerCaptureProtectionConfig, hasFairPlayCertificate } from "@/lib/content-capture-protection";

export const runtime = "nodejs";

/**
 * Serve the Apple FairPlay Streaming application certificate to the player.
 * Source can be a remote URL (proxied) or an inline base64 value.
 */
export async function GET() {
  const config = getServerCaptureProtectionConfig();
  if (!config.enabled || !hasFairPlayCertificate(config)) {
    return NextResponse.json({ error: "FairPlay not configured" }, { status: 404 });
  }

  try {
    let certificate: ArrayBuffer | null = null;

    if (config.fairplayCertificateUrl) {
      const res = await fetch(config.fairplayCertificateUrl, { cache: "no-store" });
      if (!res.ok) {
        return NextResponse.json({ error: "Certificate fetch failed" }, { status: 502 });
      }
      certificate = await res.arrayBuffer();
    } else if (config.fairplayCertificateBase64) {
      certificate = Buffer.from(config.fairplayCertificateBase64, "base64").buffer as ArrayBuffer;
    }

    if (!certificate || certificate.byteLength === 0) {
      return NextResponse.json({ error: "Empty certificate" }, { status: 502 });
    }

    return new NextResponse(certificate, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("FairPlay certificate error:", err);
    return NextResponse.json({ error: "Certificate unavailable" }, { status: 500 });
  }
}
