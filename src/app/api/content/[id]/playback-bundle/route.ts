import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packPlatformImageUrl } from "@/lib/browse-media-pack";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import { getServerCaptureProtectionConfig } from "@/lib/content-capture-protection";
import {
  isS3FallbackPlayback,
  resolveServerPlaybackSource,
} from "@/lib/server-playback-sources";
import { requiresSignedStreamPlayback } from "@/lib/cloudflare-stream-signed-url";
import {
  buildHlsManifestProxyUrl,
  pickPublishedContentVideoUrl,
} from "@/lib/playback-content-url";
import type { PlaybackSource } from "@/lib/playback-sources";
import { contentHasScriptSource } from "@/lib/ai-metadata/content-script-source";
import { getPlatformIntroPayload } from "@/lib/platform-intro";
import { buildPlaybackSubtitleTracks } from "@/lib/subtitles/playback-tracks";
import {
  inferDeviceTypeFromPlatformHeader,
  inferDeviceTypeFromUserAgent,
} from "@/lib/client-device-type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isNativeAppRequest(req: NextRequest): boolean {
  const fromHeader = inferDeviceTypeFromPlatformHeader(req.headers.get("x-st-platform"));
  if (fromHeader === "mobile" || fromHeader === "tablet" || fromHeader === "tv") return true;
  const uaClass = inferDeviceTypeFromUserAgent(req.headers.get("user-agent"));
  return uaClass === "mobile" || uaClass === "tablet" || uaClass === "tv";
}

const episodeSelect = {
  id: true,
  duration: true,
  videoUrl: true,
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";
    const native = isNativeAppRequest(req);
    // Native apps: lean bundle by default so play starts without waiting on scenes/enrichment.
    const lite =
      req.nextUrl.searchParams.get("lite") === "1" ||
      req.nextUrl.searchParams.get("fields") === "core" ||
      (native && req.nextUrl.searchParams.get("lite") !== "0");

    const content = lite
      ? await prisma.content.findFirst({
          where: { id, published: true },
          select: {
            id: true,
            title: true,
            posterUrl: true,
            backdropUrl: true,
            videoUrl: true,
            trailerUrl: true,
            duration: true,
            type: true,
            seasons: {
              where: { published: true },
              orderBy: { seasonNumber: "asc" },
              select: {
                episodes: {
                  orderBy: { episodeNumber: "asc" },
                  select: episodeSelect,
                },
              },
            },
          },
        })
      : await prisma.content.findFirst({
          where: { id, published: true },
          select: {
            id: true,
            title: true,
            posterUrl: true,
            backdropUrl: true,
            videoUrl: true,
            trailerUrl: true,
            duration: true,
            type: true,
            linkedProjectId: true,
            scriptUrl: true,
            tags: true,
            seasons: {
              where: { published: true },
              orderBy: { seasonNumber: "asc" },
              select: {
                episodes: {
                  orderBy: { episodeNumber: "asc" },
                  select: episodeSelect,
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

    const videoUrl = pickPublishedContentVideoUrl(content, { episodeId, trailer: isTrailer });
    if (!videoUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let duration = isTrailer ? null : content.duration;
    if (!isTrailer && episodeId) {
      const episode = content.seasons
        .flatMap((s) => s.episodes)
        .find((e) => e.id === episodeId);
      duration = episode?.duration ?? duration;
    } else if (!isTrailer && !duration) {
      duration =
        content.seasons.flatMap((s) => s.episodes).find((e) => e.duration)?.duration ?? duration;
    }

    const [upstreamPlayback, posterPacked, session] = await Promise.all([
      resolveServerPlaybackSource(videoUrl).catch((err) => {
        console.error("playback-bundle resolve source failed:", err);
        return null;
      }),
      packPlatformImageUrl(getDisplayPosterUrl(content), undefined, { role: "poster" }).catch(
        () => null,
      ),
      getServerSession(authOptions).catch((sessionErr) => {
        console.error("playback-bundle session lookup failed:", sessionErr);
        return null;
      }),
    ]);

    let playback: PlaybackSource | null = upstreamPlayback;
    if (upstreamPlayback?.type === "application/x-mpegurl") {
      playback = {
        src: buildHlsManifestProxyUrl(id, {
          episodeId,
          trailer: isTrailer,
          upstreamSrc: upstreamPlayback.src,
        }),
        type: "application/x-mpegurl",
      };
    }

    if (isS3FallbackPlayback(upstreamPlayback) && videoUrl) {
      after(async () => {
        try {
          const { ensureVideoIngested } = await import("@/lib/stream-ingest-link");
          await ensureVideoIngested(videoUrl, { area: "playback-recovery", contentId: id });
        } catch (err) {
          console.error("playback-bundle stream recovery ingest failed:", err);
        }
      });
    }

    const posterUrl = posterPacked ?? getDisplayPosterUrl(content);
    const captureProtection = getServerCaptureProtectionConfig();

    const basePayload = {
      id: content.id,
      title: content.title,
      playback,
      platformIntro: getPlatformIntroPayload({
        trailer: isTrailer,
        hlsProxied: playback?.type === "application/x-mpegurl",
      }),
      playbackProtection: {
        signedUrl: requiresSignedStreamPlayback(),
        proxiedManifest: playback?.type === "application/x-mpegurl",
        expiresHintSeconds: 4 * 60 * 60,
        authenticatedViewer: Boolean(session?.user?.id),
      },
      posterUrl,
      duration,
      captureProtection: {
        enabled: captureProtection.enabled,
        mode: captureProtection.mode,
        watermarkEnabled: captureProtection.watermarkEnabled,
        drmConfigured: Boolean(captureProtection.drmLicenseUrl),
        drmLicensePath: captureProtection.drmLicenseUrl ? "/api/content/drm-license" : null,
      },
    };

    if (lite) {
      return NextResponse.json(
        {
          ...basePayload,
          enrichment: null,
          scenes: [],
          sceneIntelligence: null,
          subtitles: [],
          lite: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
          },
        },
      );
    }

    const full = content as typeof content & {
      enrichment?: {
        status: string | null;
        moodTags: unknown;
        atmosphere: unknown;
        pacing: unknown;
        narrativeJson: unknown;
      } | null;
      scenes?: Array<{
        id: string;
        startSeconds: number;
        endSeconds: number | null;
        summary: string | null;
        mood: string | null;
        actors: unknown;
      }>;
      subtitles?: Array<{
        id: string;
        language: string;
        label: string | null;
        vttUrl: string;
        isDefault: boolean;
      }>;
      scriptUrl?: string | null;
      linkedProjectId?: string | null;
      tags?: string | null;
    };

    const hasScriptSource = contentHasScriptSource(full);
    const sceneCount = full.scenes?.length ?? 0;
    const enrichmentStatus = full.enrichment?.status ?? null;
    const intelligencePending =
      !isTrailer &&
      sceneCount === 0 &&
      hasScriptSource &&
      enrichmentStatus !== "PROCESSING" &&
      Boolean(process.env.OPENAI_API_KEY?.trim());

    if (intelligencePending) {
      after(async () => {
        try {
          const { ensureSceneIntelligence } = await import(
            "@/lib/ai-metadata/ensure-scene-intelligence"
          );
          await ensureSceneIntelligence(id);
        } catch (err) {
          console.error("playback-bundle scene intelligence enqueue failed:", err);
        }
      });
    }

    return NextResponse.json(
      {
        ...basePayload,
        enrichment: isTrailer ? null : full.enrichment ?? null,
        scenes: isTrailer ? [] : full.scenes ?? [],
        sceneIntelligence: isTrailer
          ? null
          : {
              status: enrichmentStatus,
              sceneCount,
              hasScriptSource,
              pending: intelligencePending || enrichmentStatus === "PROCESSING",
            },
        subtitles: isTrailer
          ? []
          : buildPlaybackSubtitleTracks(
              content.id,
              (full.subtitles ?? []).map((row) => ({
                id: row.id,
                language: row.language,
                label: row.label ?? row.language,
                vttUrl: row.vttUrl,
                isDefault: row.isDefault,
              })),
            ),
        lite: false,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("playback-bundle error:", message, stack);
    return NextResponse.json({ error: "Failed", detail: message }, { status: 500 });
  }
}
