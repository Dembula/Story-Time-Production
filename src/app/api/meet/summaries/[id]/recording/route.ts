import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";
import { getStorageObjectStream } from "@/lib/storage-object-fetch";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Authenticated Meet recording playback.
 * Streams (with Range) from platform storage so clients never open the raw bucket URL.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await prisma.meetSummary.findFirst({
    where: {
      id,
      OR: [
        { createdByUserId: session.userId },
        { meeting: { hostUserId: session.userId } },
        { meeting: { participants: { some: { userId: session.userId } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      recordingUrl: true,
    },
  });

  if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!summary.recordingUrl) {
    return NextResponse.json({ error: "No recording for this summary" }, { status: 404 });
  }

  const ref = resolveStorageObjectRef(summary.recordingUrl);
  if (!ref) {
    // Legacy absolute URL that isn't in our storage — still avoid dumping it in the UI
    // by proxying via redirect only when it's already https.
    if (/^https?:\/\//i.test(summary.recordingUrl)) {
      return NextResponse.redirect(summary.recordingUrl, 302);
    }
    return NextResponse.json({ error: "Recording storage reference is invalid" }, { status: 404 });
  }

  try {
    const stream = await getStorageObjectStream(ref, {
      rangeHeader: req.headers.get("range"),
    });
    const headers = new Headers({
      "Content-Type": stream.contentType || "video/webm",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Accept-Ranges": stream.acceptRanges,
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
  } catch (err) {
    console.error("[meet] recording stream failed", err);
    return NextResponse.json({ error: "Could not load recording" }, { status: 404 });
  }
}
