import { NextRequest, NextResponse } from "next/server";
import { getStorageObjectStream } from "@/lib/storage-object-fetch";
import { parseCatalogueMediaProxyPath } from "@/lib/catalogue-media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stable public proxy for catalogue posters/backdrops.
 * Path is keyed by bucket + object key (no signatures) so `/_next/image` can cache transforms.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ bucket: string; key: string[] }> },
) {
  const { bucket, key: keyParts } = await context.params;
  const ref = parseCatalogueMediaProxyPath(bucket, keyParts ?? []);
  if (!ref) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const stream = await getStorageObjectStream(ref, {
      rangeHeader: req.headers.get("range"),
    });
    const headers = new Headers({
      "Content-Type": stream.contentType,
      // Long CDN/browser cache — object keys are content-addressed by upload path.
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
