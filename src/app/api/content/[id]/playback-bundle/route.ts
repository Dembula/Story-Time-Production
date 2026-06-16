import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";
    const session = await getServerSession(authOptions);

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
        minAge: true,
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

    if (!isTrailer) {
      const role = (session?.user as { role?: string } | undefined)?.role;
      if (!session?.user?.id || role !== "SUBSCRIBER") {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      const profileId = req.cookies.get("st_viewer_profile")?.value;
      if (!profileId) {
        return NextResponse.json({ error: "Viewer profile required" }, { status: 403 });
      }

      const [playbackState, profile] = await Promise.all([
        getViewerPlaybackState(session.user.id, content.id),
        prisma.viewerProfile.findFirst({
          where: { id: profileId, userId: session.user.id },
          select: { age: true, dateOfBirth: true },
        }),
      ]);

      const profileAge = profile ? getViewerProfileAge(profile) : null;
      if (!playbackState.canPlayContent || !profile || (profileAge != null && content.minAge > profileAge)) {
        return NextResponse.json({ error: "Playback not allowed" }, { status: 403 });
      }
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

    const playback = await resolveServerPlaybackSource(videoUrl);
    const posterUrl = getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
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
          drmFairPlayCertificatePath: captureProtection.fairPlayCertificateUrl
            ? "/api/content/drm-fairplay-cert"
            : null,
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
