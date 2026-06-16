import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import {
  isS3FallbackPlayback,
  resolveServerPlaybackSource,
} from "@/lib/server-playback-sources";
import { requiresSignedStreamPlayback } from "@/lib/cloudflare-stream-signed-url";
import { ensureVideoIngested } from "@/lib/stream-ingest-link";
import {
  buildHlsManifestProxyUrl,
  resolvePublishedContentVideoUrl,
} from "@/lib/playback-content-url";
import type { PlaybackSource } from "@/lib/playback-sources";
import { ensureSceneIntelligence } from "@/lib/ai-metadata/ensure-scene-intelligence";
import { contentHasScriptSource } from "@/lib/ai-metadata/resolve-content-script";

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const content = await prisma.content.findFirst({
      where: { id, published: true },
      select: {
        id: true,
        title: true,
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
              select: { id: true, duration: true },
            },
          },
        },
        linkedProjectId: true,
        scriptUrl: true,
        tags: true,
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
          take: 64,
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

    let duration = isTrailer ? null : content.duration;
    if (!isTrailer && episodeId) {
      const episode = content.seasons
        .flatMap((s) => s.episodes)
        .find((e) => e.id === episodeId);
      duration = episode?.duration ?? duration;
    } else if (!isTrailer && !duration) {
      duration = content.seasons.flatMap((s) => s.episodes).find((e) => e.duration)?.duration ?? duration;
    }

    const upstreamPlayback = await resolveServerPlaybackSource(videoUrl);
    let playback: PlaybackSource | null = upstreamPlayback;

    if (upstreamPlayback?.type === "application/x-mpegurl") {
      playback = {
        src: buildHlsManifestProxyUrl(id, { episodeId, trailer: isTrailer }),
        type: "application/x-mpegurl",
      };
    }

    if (isS3FallbackPlayback(upstreamPlayback) && videoUrl) {
      after(async () => {
        try {
          await ensureVideoIngested(videoUrl, { area: "playback-recovery", contentId: id });
        } catch (err) {
          console.error("playback-bundle stream recovery ingest failed:", err);
        }
      });
    }

    const posterUrl = getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();
    const session = await getServerSession(authOptions);

    const hasScriptSource = contentHasScriptSource(content);
    const sceneCount = content.scenes.length;
    const enrichmentStatus = content.enrichment?.status ?? null;
    const intelligencePending =
      !isTrailer &&
      sceneCount === 0 &&
      hasScriptSource &&
      enrichmentStatus !== "PROCESSING" &&
      Boolean(process.env.OPENAI_API_KEY?.trim());

    if (intelligencePending) {
      after(async () => {
        try {
          await ensureSceneIntelligence(id);
        } catch (err) {
          console.error("playback-bundle scene intelligence enqueue failed:", err);
        }
      });
    }

    return NextResponse.json(
      {
        id: content.id,
        title: content.title,
        playback,
        playbackProtection: {
          signedUrl: requiresSignedStreamPlayback(),
          proxiedManifest: playback?.type === "application/x-mpegurl",
          expiresHintSeconds: 4 * 60 * 60,
          authenticatedViewer: Boolean(session?.user?.id),
        },
        posterUrl,
        duration,
        enrichment: isTrailer ? null : content.enrichment,
        scenes: isTrailer ? [] : content.scenes,
        sceneIntelligence: isTrailer
          ? null
          : {
              status: enrichmentStatus,
              sceneCount,
              hasScriptSource,
              pending: intelligencePending || enrichmentStatus === "PROCESSING",
            },
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
