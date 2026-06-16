import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";
import { buildPlaybackManifest } from "@/lib/playback/manifest";
import { getAppBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";

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

    const session = await getServerSession(authOptions);
    const baseUrl = getAppBaseUrl() || null;
    const contentScope = episodeId ? `${content.id}:${episodeId}` : content.id;

    // New unified manifest (HLS + DASH + DRM + subs + thumbnails).
    const manifest = await buildPlaybackManifest({
      baseUrl,
      contentScope,
      videoUrl,
      subtitles: isTrailer
        ? []
        : (content.subtitles ?? []).map((s) => ({
            id: s.id,
            language: s.language,
            label: s.label,
            vttUrl: s.vttUrl,
            isDefault: s.isDefault,
          })),
      watermarkActive: !isTrailer && Boolean(session?.user?.id),
      concurrentSessionsEnforced: true,
      deviceFamilyHint: "unknown",
    });

    // Back-compat single playback source for legacy clients.
    const playback = await resolveServerPlaybackSource(videoUrl);
    const posterUrl = getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
        manifest,
        playbackProtection: {
          signedUrl: manifest.compliance.signedPlayback,
          expiresHintSeconds: manifest.compliance.expiresInSeconds ?? 4 * 60 * 60,
          authenticatedViewer: Boolean(session?.user?.id),
          fairPlayReady: manifest.compliance.fairPlayReady,
          hardwareDrm: manifest.compliance.hardwareDrm,
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
          drmConfigured: Boolean(captureProtection.drmLicenseUrl) || manifest.compliance.hardwareDrm,
          drmLicensePath: captureProtection.drmLicenseUrl ? "/api/content/drm-license" : null,
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
