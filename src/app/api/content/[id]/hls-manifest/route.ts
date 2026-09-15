import { NextRequest, NextResponse } from "next/server";
import {
  decodeVariantRef,
  encodeVariantRef,
  isAllowedHlsVariantUpstream,
  loadPlatformIntroFmp4AudioPlaylist,
  loadPlatformIntroFmp4VideoPlaylist,
  loadPlatformIntroMediaPlaylist,
  masterHasDemuxedAudio,
  playlistIsMaster,
  playlistUsesFragmentedMp4,
  rewriteMasterPlaylistForIntroStitch,
  stitchIntroIntoMediaPlaylist,
  withPublicOrigin,
} from "@/lib/playback-intro-stitch";
import {
  decodeUpstreamPlaybackRef,
  resolvePublishedContentVideoUrl,
} from "@/lib/playback-content-url";
import { rewriteHlsManifestForProxy } from "@/lib/playback-manifest-rewrite";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";

export const runtime = "nodejs";

function hlsResponse(body: string, cacheSeconds = 20) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      // Short private cache — cuts repeated play taps while token is warm.
      "Cache-Control": `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 3}`,
    },
  });
}

async function fetchUpstreamManifest(url: string): Promise<string | null> {
  const upstream = await fetch(url, {
    method: "GET",
    headers: { Accept: "*/*" },
    redirect: "follow",
    // Allow brief CDN reuse of the signed master while our isolate is warm.
    next: { revalidate: 15 },
  });
  if (!upstream.ok) {
    console.error("hls-manifest upstream failed:", upstream.status, url.slice(0, 120));
    return null;
  }
  return upstream.text();
}

async function stitchWithMatchingIntro(
  featureMedia: string,
  origin: string,
): Promise<string> {
  // Stream demuxed fMP4 → stitch matching fMP4 intro video/audio tracks.
  // Legacy MPEG-TS features → stitch MPEG-TS intro.
  if (playlistUsesFragmentedMp4(featureMedia)) {
    const intro = withPublicOrigin(await loadPlatformIntroFmp4VideoPlaylist(), origin);
    return stitchIntroIntoMediaPlaylist(intro, featureMedia);
  }
  const intro = withPublicOrigin(await loadPlatformIntroMediaPlaylist(), origin);
  return stitchIntroIntoMediaPlaylist(intro, featureMedia);
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
    const audioRef = req.nextUrl.searchParams.get("audio")?.trim() || null;
    // Default ON for apps that only play playback.src. Opt out with intro=0.
    const wantStitch = !isTrailer && req.nextUrl.searchParams.get("intro") !== "0";
    const origin = req.nextUrl.origin;
    const upstreamFromBundle = decodeUpstreamPlaybackRef(req.nextUrl.searchParams.get("u"));

    if (audioRef) {
      const audioUrl = decodeVariantRef(audioRef);
      if (!audioUrl || !isAllowedHlsVariantUpstream(audioUrl)) {
        return new NextResponse("Invalid audio", { status: 400 });
      }
      const mediaRaw = await fetchUpstreamManifest(audioUrl);
      if (!mediaRaw) return new NextResponse("Upstream audio unavailable", { status: 502 });
      const media = rewriteHlsManifestForProxy(mediaRaw, audioUrl);
      if (!wantStitch) return hlsResponse(media, 30);
      try {
        const intro = withPublicOrigin(await loadPlatformIntroFmp4AudioPlaylist(), origin);
        return hlsResponse(stitchIntroIntoMediaPlaylist(intro, media), 30);
      } catch (err) {
        console.error("platform intro audio stitch failed; serving feature audio only", err);
        return hlsResponse(media, 30);
      }
    }

    if (variantRef) {
      const variantUrl = decodeVariantRef(variantRef);
      if (!variantUrl || !isAllowedHlsVariantUpstream(variantUrl)) {
        return new NextResponse("Invalid variant", { status: 400 });
      }
      const mediaRaw = await fetchUpstreamManifest(variantUrl);
      if (!mediaRaw) return new NextResponse("Upstream manifest unavailable", { status: 502 });
      const media = rewriteHlsManifestForProxy(mediaRaw, variantUrl);
      if (!wantStitch) return hlsResponse(media, 30);
      try {
        return hlsResponse(await stitchWithMatchingIntro(media, origin), 30);
      } catch (err) {
        console.error("platform intro stitch failed; serving feature only", err);
        return hlsResponse(media, 30);
      }
    }

    let playbackSrc = upstreamFromBundle;
    if (!playbackSrc) {
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
      playbackSrc = playback.src;
    }

    const raw = await fetchUpstreamManifest(playbackSrc);
    if (!raw) return new NextResponse("Upstream manifest unavailable", { status: 502 });

    const rewritten = rewriteHlsManifestForProxy(raw, playbackSrc);

    if (!wantStitch) {
      return hlsResponse(rewritten, 45);
    }

    if (playlistIsMaster(rewritten)) {
      // Stream demuxed A/V: proxy both tracks so bumper video + audio stay aligned.
      // Muxed masters: do not stitch (would mix video-only bumper into muxed media).
      if (!masterHasDemuxedAudio(rewritten)) {
        return hlsResponse(rewritten, 45);
      }
      const stitchedMaster = rewriteMasterPlaylistForIntroStitch(rewritten, {
        buildVariantProxyUrl: (absoluteVariantUrl) => {
          const params = new URLSearchParams();
          if (episodeId) params.set("episodeId", episodeId);
          params.set("variant", encodeVariantRef(absoluteVariantUrl));
          return `${origin}/api/content/${id}/hls-manifest?${params.toString()}`;
        },
        buildAudioProxyUrl: (absoluteAudioUrl) => {
          const params = new URLSearchParams();
          if (episodeId) params.set("episodeId", episodeId);
          params.set("audio", encodeVariantRef(absoluteAudioUrl));
          return `${origin}/api/content/${id}/hls-manifest?${params.toString()}`;
        },
      });
      return hlsResponse(stitchedMaster, 20);
    }

    try {
      return hlsResponse(await stitchWithMatchingIntro(rewritten, origin), 20);
    } catch (err) {
      console.error("platform intro stitch failed; serving feature only", err);
      return hlsResponse(rewritten, 20);
    }
  } catch (err) {
    console.error("hls-manifest error:", err);
    return new NextResponse("Failed", { status: 500 });
  }
}
