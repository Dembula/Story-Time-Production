import { NextRequest, NextResponse } from "next/server";
import { resolvePublishedContentVideoUrl } from "@/lib/playback-content-url";
import { rewriteHlsManifestForProxy } from "@/lib/playback-manifest-rewrite";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";

    const videoUrl = await resolvePublishedContentVideoUrl(id, { episodeId, trailer: isTrailer });
    if (!videoUrl) {
      return new NextResponse("Not found", { status: 404 });
    }

    const playback = await resolveServerPlaybackSource(videoUrl);
    if (!playback?.src || playback.type !== "application/x-mpegurl") {
      return new NextResponse("Playback unavailable", { status: 404 });
    }

    const upstream = await fetch(playback.src, {
      method: "GET",
      headers: { Accept: "*/*" },
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      console.error(
        "hls-manifest upstream failed:",
        upstream.status,
        playback.src.slice(0, 120),
      );
      return new NextResponse("Upstream manifest unavailable", { status: 502 });
    }

    const body = rewriteHlsManifestForProxy(await upstream.text(), playback.src);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("hls-manifest error:", err);
    return new NextResponse("Failed", { status: 500 });
  }
}
