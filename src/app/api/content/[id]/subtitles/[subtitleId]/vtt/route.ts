import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSubtitleText(url: string): Promise<string | null> {
  const packed = packBrowserMediaUrl(url) ?? url;
  if (!packed.startsWith("http")) return null;

  const res = await fetch(packed, {
    headers: { Accept: "text/vtt, text/plain, */*" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; subtitleId: string }> },
) {
  try {
    const { id: contentId, subtitleId } = await params;

    const subtitle = await prisma.contentSubtitle.findFirst({
      where: {
        id: subtitleId,
        content: { id: contentId, published: true },
      },
      select: { vttUrl: true },
    });

    if (!subtitle?.vttUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const text = await fetchSubtitleText(subtitle.vttUrl);
    if (!text) {
      return NextResponse.json({ error: "Subtitle unavailable" }, { status: 502 });
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("subtitle vtt proxy error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
