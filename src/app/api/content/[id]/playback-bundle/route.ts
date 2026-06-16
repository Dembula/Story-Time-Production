import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { isCloudflareSignedPlaybackEnabled } from "@/lib/cloudflare-stream-signed-url";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";
import { VIEWER_PROFILE_COOKIE } from "@/lib/viewer-profile-cookies";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { getViewerPlaybackState } from "@/lib/viewer-access";

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
        minAge: true,
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

    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;

    if (!isTrailer) {
      if (!sessionUser?.id || sessionUser.role !== "SUBSCRIBER") {
        return NextResponse.json({ error: "Playback requires an active subscriber session" }, { status: 401 });
      }

      const cookieStore = await cookies();
      const profileId = cookieStore.get(VIEWER_PROFILE_COOKIE)?.value;
      if (!profileId) {
        return NextResponse.json({ error: "Viewer profile required" }, { status: 428 });
      }

      const [profile, playbackState] = await Promise.all([
        prisma.viewerProfile.findFirst({
          where: { id: profileId, userId: sessionUser.id },
          select: { age: true, dateOfBirth: true },
        }),
        getViewerPlaybackState(sessionUser.id, content.id),
      ]);

      if (!playbackState.subscription) {
        return NextResponse.json({ error: "Subscription required" }, { status: 403 });
      }

      const profileAge = getViewerProfileAge(profile);
      const minAge = content.minAge ?? 0;
      const ageRestricted = profileAge != null && minAge > profileAge;
      if (ageRestricted || !playbackState.canPlayContent) {
        return NextResponse.json({ error: "You are not allowed to play this title" }, { status: 403 });
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
    const signedPlayback =
      isCloudflareSignedPlaybackEnabled() &&
      playback?.type === "application/x-mpegurl" &&
      playback.src.includes("/manifest/video.m3u8");

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
        playbackProtection: {
          signedUrl: signedPlayback,
          expiresHintSeconds: 4 * 60 * 60,
          authenticatedViewer: Boolean(sessionUser?.id),
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
