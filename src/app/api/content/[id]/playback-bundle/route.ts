import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import {
  getServerCaptureProtectionConfig,
  hasFairPlayCertificate,
} from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { resolveServerPlayback } from "@/lib/server-playback-sources";
import { reconcileStreamAsset } from "@/lib/cloudflare-stream-status";
import { buildCloudflarePlaybackUrls, extractCloudflareStreamUid, getCloudflareStreamConfig } from "@/lib/cloudflare-stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";

    const content = await prisma.content.findFirst({
      where: { id, published: true },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        trailerUrl: true,
        posterUrl: true,
        backdropUrl: true,
        duration: true,
        type: true,
        seasons: {
          where: { published: true },
          orderBy: { seasonNumber: "asc" },
          select: {
            episodes: {
              orderBy: { episodeNumber: "asc" },
              select: { id: true, videoUrl: true, duration: true },
            },
          },
        },
        enrichment: {
          select: {
            status: true,
            moodTags: true,
            atmosphere: true,
            pacing: true,
            narrativeJson: true,
          },
        },
        scenes: {
          orderBy: { startSeconds: "asc" },
          take: 24,
          select: {
            id: true,
            startSeconds: true,
            endSeconds: true,
            summary: true,
            mood: true,
            actors: true,
          },
        },
        subtitles: {
          select: { id: true, language: true, label: true, vttUrl: true, isDefault: true },
        },
      },
    });

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;
    let duration = isTrailer ? null : content.duration;

    if (!isTrailer && episodeId) {
      const episode = content.seasons
        .flatMap((s) => s.episodes)
        .find((e) => e.id === episodeId);
      if (!episode?.videoUrl) {
        return NextResponse.json({ error: "Episode not found" }, { status: 404 });
      }
      videoUrl = episode.videoUrl;
      duration = episode.duration ?? duration;
    } else if (!isTrailer && !videoUrl && isLongFormType(content.type)) {
      const firstEpisode = content.seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl);
      if (firstEpisode?.videoUrl) {
        videoUrl = firstEpisode.videoUrl;
        duration = firstEpisode.duration ?? duration;
      }
    }

    const resolved = await resolveServerPlayback(videoUrl);
    const playback = resolved.source;

    // Self-heal: if the linked asset is still transcoding, poll Cloudflare in the
    // background so the next load resolves to adaptive HLS without waiting on a webhook.
    if (resolved.processing && resolved.streamUid) {
      const uid = resolved.streamUid;
      after(async () => {
        try {
          await reconcileStreamAsset(uid);
        } catch (reconcileErr) {
          console.error("Opportunistic stream reconcile failed:", reconcileErr);
        }
      });
    }

    const posterUrl = getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();
    const session = await getServerSession(authOptions);

    const streamUid = resolved.streamUid ?? extractCloudflareStreamUid(playback?.src ?? null);
    const cfg = getCloudflareStreamConfig();
    const dashUrl =
      streamUid && cfg ? buildCloudflarePlaybackUrls(streamUid, cfg.customerSubdomain).dashUrl : null;
    const fairplayAvailable =
      captureProtection.enabled &&
      Boolean(captureProtection.drmLicenseUrl) &&
      hasFairPlayCertificate(captureProtection);

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
        // Alternative renditions for multi-DRM clients (Widevine/PlayReady prefer DASH).
        playbackAlternatives: dashUrl ? { dash: dashUrl } : null,
        processing: resolved.processing,
        streamStatus: resolved.status,
        playbackProtection: {
          signedUrl: Boolean(playback?.src.includes("/manifest/video.m3u8") && playback.src.includes(".")),
          expiresHintSeconds: 4 * 60 * 60,
          authenticatedViewer: Boolean(session?.user?.id),
        },
        posterUrl,
        duration,
        enrichment: isTrailer ? null : content.enrichment,
        scenes: isTrailer ? [] : content.scenes,
        subtitles: isTrailer ? [] : content.subtitles,
        captureProtection: {
          enabled: captureProtection.enabled,
          mode: captureProtection.mode,
          watermarkEnabled: captureProtection.watermarkEnabled,
          drmConfigured: Boolean(captureProtection.drmLicenseUrl),
          drmLicensePath: captureProtection.drmLicenseUrl ? "/api/content/drm-license" : null,
          fairplayConfigured: fairplayAvailable,
          fairplayCertificatePath: fairplayAvailable ? "/api/content/drm-certificate" : null,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (err) {
    console.error("playback-bundle error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
