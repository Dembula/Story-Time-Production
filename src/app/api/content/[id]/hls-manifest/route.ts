import { NextRequest, NextResponse } from "next/server";
import {
  decodeVariantRef,
  encodeVariantRef,
  isAllowedHlsVariantUpstream,
  loadPlatformIntroMediaPlaylist,
  playlistIsMaster,
  rewriteMasterPlaylistForIntroStitch,
  stitchIntroIntoMediaPlaylist,
} from "@/lib/playback-intro-stitch";
import { resolvePublishedContentVideoUrl } from "@/lib/playback-content-url";
import { rewriteHlsManifestForProxy } from "@/lib/playback-manifest-rewrite";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";

export const runtime = "nodejs";

function hlsResponse(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

async function fetchUpstreamManifest(url: string): Promise<string | null> {
  const upstream = await fetch(url, {
    method: "GET",
    headers: { Accept: "*/*" },
    redirect: "follow",
    cache: "no-store",
  });
  if (!upstream.ok) {
    console.error("hls-manifest upstream failed:", upstream.status, url.slice(0, 120));
    return null;
  }
  return upstream.text();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";
    const variantRef = req.nextUrl.searchParams.get("variant")?.trim() || null;
    const shouldStitchIntro = !isTrailer;

    if (variantRef) {
      const variantUrl = decodeVariantRef(variantRef);
      if (!variantUrl || !isAllowedHlsVariantUpstream(variantUrl)) {
        return new NextResponse("Invalid variant", { status: 400 });
      }
      const mediaRaw = await fetchUpstreamManifest(variantUrl);
      if (!mediaRaw) return new NextResponse("Upstream manifest unavailable", { status: 502 });
      const media = rewriteHlsManifestForProxy(mediaRaw, variantUrl);
      if (!shouldStitchIntro) return hlsResponse(media);
      try {
        const intro = await loadPlatformIntroMediaPlaylist();
        return hlsResponse(stitchIntroIntoMediaPlaylist(intro, media));
      } catch (err) {
        console.error("platform intro stitch failed; serving feature only", err);
        return hlsResponse(media);
      }
    }

    const videoUrl = await resolvePublishedContentVideoUrl(id, { episodeId, trailer: isTrailer });
    if (!videoUrl) {
      return new NextResponse("Not found", { status: 404 });
    }

    const playback = await resolveServerPlaybackSource(videoUrl).catch((err) => {
      console.error("hls-manifest resolve source failed:", err);
      return null;
    });
    if (!playback?.src || playback.type !== "application/x-mpegurl") {
      return new NextResponse("Playback unavailable", { status: 404 });
    }

    const raw = await fetchUpstreamManifest(playback.src);
    if (!raw) return new NextResponse("Upstream manifest unavailable", { status: 502 });

    const rewritten = rewriteHlsManifestForProxy(raw, playback.src);

    if (!shouldStitchIntro) {
      return hlsResponse(rewritten);
    }

    if (playlistIsMaster(rewritten)) {
      const stitchedMaster = rewriteMasterPlaylistForIntroStitch(rewritten, (absoluteVariantUrl) => {
        const params = new URLSearchParams();
        if (episodeId) params.set("episodeId", episodeId);
        params.set("variant", encodeVariantRef(absoluteVariantUrl));
        return `/api/content/${id}/hls-manifest?${params.toString()}`;
      });
      return hlsResponse(stitchedMaster);
    }

    try {
      const intro = await loadPlatformIntroMediaPlaylist();
      return hlsResponse(stitchIntroIntoMediaPlaylist(intro, rewritten));
    } catch (err) {
      console.error("platform intro stitch failed; serving feature only", err);
      return hlsResponse(rewritten);
    }
  } catch (err) {
    console.error("hls-manifest error:", err);
    return new NextResponse("Failed", { status: 500 });
  }
}
