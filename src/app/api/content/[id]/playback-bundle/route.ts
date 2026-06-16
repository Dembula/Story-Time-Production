import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import { isLongFormType } from "@/lib/content-types";
import { resolvePlaybackBundle } from "@/lib/playback/source-bundle";
import { buildDrmClientHint, resolveDrmEndpoints } from "@/lib/playback/drm";

type SubtitleTrack = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

function buildSubtitleTracks(subtitles: SubtitleTrack[] | undefined) {
  if (!subtitles?.length) return [];
  // Guarantee exactly one default track so the player has a deterministic startup choice.
  const hasDefault = subtitles.some((s) => s.isDefault);
  return subtitles.map((track, index) => ({
    id: track.id,
    src: track.vttUrl,
    language: track.language,
    label: track.label || track.language.toUpperCase(),
    kind: "subtitles" as const,
    default: track.isDefault || (!hasDefault && index === 0 && track.language === "en"),
  }));
}

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

    const bundle = await resolvePlaybackBundle(videoUrl);
    const playback = bundle?.primary ?? null;
    const posterUrl = getDisplayPosterUrl(content) ?? bundle?.previews.posterUrl ?? null;
    const captureProtection = getServerCaptureProtectionConfig();
    const drmSummary = resolveDrmEndpoints(videoUrl);
    const drmClient = buildDrmClientHint(drmSummary);
    const session = await getServerSession(authOptions);

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        // Keep `playback` shaped exactly as before for back-compat with the existing player.
        playback,
        playbackBundle: bundle
          ? {
              formats: bundle.formats,
              streamUid: bundle.streamUid,
              signed: bundle.signed,
              previews: bundle.previews,
            }
          : null,
        tracks: buildSubtitleTracks(content.subtitles),
        playbackProtection: {
          signedUrl: bundle?.signed ?? false,
          expiresHintSeconds: 4 * 60 * 60,
          authenticatedViewer: Boolean(session?.user?.id),
          drm: drmClient,
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
          drmConfigured: drmClient.enabled,
          drmSystems: drmClient.systems,
          drmLicensePath: drmClient.proxy.licensePath,
          fairplayCertPath: drmClient.proxy.fairplayCertPath,
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
