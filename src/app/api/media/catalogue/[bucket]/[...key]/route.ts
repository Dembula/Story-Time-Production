import { NextRequest, NextResponse } from "next/server";
import { getStorageObjectSignedUrl, getStorageObjectStream } from "@/lib/storage-object-fetch";
import { parseCatalogueMediaProxyPath } from "@/lib/catalogue-media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Keep short — this path must not become a long-lived origin for millions of image bytes. */
export const maxDuration = 15;

function catalogueProxyMode(): "off" | "redirect" | "stream" {
  const raw = process.env.CATALOGUE_MEDIA_PROXY?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return "off";
  if (raw === "stream") return "stream";
  // Default when explicitly enabled without a mode: redirect (cheap) not stream (expensive).
  if (raw === "1" || raw === "true" || raw === "on" || raw === "redirect") return "redirect";
  // Unset: allow legacy clients that already have /api/media/catalogue URLs, via redirect only.
  return "redirect";
}

/**
 * Stable public path for catalogue posters/backdrops.
 * Prefer 302 → signed S3 URL so Vercel does not proxy image bytes under load.
 * Set CATALOGUE_MEDIA_PROXY=stream only if you need same-origin body streaming.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ bucket: string; key: string[] }> },
) {
  const mode = catalogueProxyMode();
  if (mode === "off") {
    return NextResponse.json({ error: "Catalogue media proxy disabled" }, { status: 404 });
  }

  const { bucket, key: keyParts } = await context.params;
  const ref = parseCatalogueMediaProxyPath(bucket, keyParts ?? []);
  if (!ref) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (mode === "redirect") {
      const signed = await getStorageObjectSignedUrl(ref, 60 * 60);
      return NextResponse.redirect(signed, {
        status: 302,
        headers: {
          // Short browser cache on the redirect decision; object itself is cached at S3/CDN.
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
      });
    }

    const stream = await getStorageObjectStream(ref, {
      rangeHeader: req.headers.get("range"),
    });
    const headers = new Headers({
      "Content-Type": stream.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Accept-Ranges": stream.acceptRanges,
      Vary: "Accept, Accept-Encoding",
    });
    if (stream.contentLength != null) {
      headers.set("Content-Length", String(stream.contentLength));
    }
    if (stream.contentRange) {
      headers.set("Content-Range", stream.contentRange);
    }
    return new NextResponse(stream.body as unknown as BodyInit, {
      status: stream.statusCode,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Could not load media" }, { status: 404 });
  }
}
