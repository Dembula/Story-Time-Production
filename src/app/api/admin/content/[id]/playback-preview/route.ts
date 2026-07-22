import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";
import {
  isS3FallbackPlayback,
  resolveServerPlaybackSource,
} from "@/lib/server-playback-sources";
import type { PlaybackSource } from "@/lib/playback-sources";
import { isLongFormType } from "@/lib/content-types";
import { packAdminImageUrl } from "@/lib/admin-content-media-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only review playback for unpublished catalogue titles.
 * Resolves Stream HLS (signed when required) or a signed S3 MP4 fallback.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const isTrailer = req.nextUrl.searchParams.get("trailer") === "1";
    const episodeId = req.nextUrl.searchParams.get("episodeId")?.trim() || null;

    const content = await prisma.content.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        videoUrl: true,
        trailerUrl: true,
        posterUrl: true,
        backdropUrl: true,
        seasons: {
          orderBy: { seasonNumber: "asc" },
          select: {
            episodes: {
              orderBy: { episodeNumber: "asc" },
              select: { id: true, videoUrl: true, title: true },
            },
          },
        },
      },
    });

    if (!content) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;
    let episodeTitle: string | null = null;

    if (!isTrailer && episodeId) {
      const episode = content.seasons.flatMap((s) => s.episodes).find((e) => e.id === episodeId);
      videoUrl = episode?.videoUrl ?? null;
      episodeTitle = episode?.title ?? null;
    } else if (!isTrailer && !videoUrl && isLongFormType(content.type)) {
      const first = content.seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl);
      videoUrl = first?.videoUrl ?? null;
      episodeTitle = first?.title ?? null;
    }

    if (!videoUrl?.trim()) {
      return NextResponse.json(
        { error: isTrailer ? "No trailer uploaded for this title." : "No film video uploaded for this title." },
        { status: 404 },
      );
    }

    let playback: PlaybackSource | null = null;
    try {
      playback = await resolveServerPlaybackSource(videoUrl);
    } catch (err) {
      console.error("admin playback-preview resolve failed:", err);
    }

    if (!playback?.src) {
      return NextResponse.json(
        {
          error:
            "Playback is not ready yet. The file may still be encoding for streaming — try again shortly.",
        },
        { status: 409 },
      );
    }

    if (isS3FallbackPlayback(playback) && videoUrl) {
      after(async () => {
        try {
          const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
          await linkOrIngestStreamForUrl(videoUrl, "Content", id, {
            area: isTrailer ? "content-trailer" : "admin-review-recovery",
            contentId: id,
            source: "storytime-admin-preview-recovery",
          });
        } catch (err) {
          console.error("admin playback-preview stream recovery failed:", err);
        }
      });
    }

    // If Stream previously failed, kick a re-encode while still serving S3 fallback.
    if (playback?.src && videoUrl) {
      after(async () => {
        try {
          const { findStreamAssetBySourceUrl } = await import("@/lib/stream-asset-store");
          const { isFailedStreamStatus } = await import("@/lib/content-approve-publish");
          const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
          const { normalizeStorageMediaUrl } = await import("@/lib/pack-storage-media-url");
          const { advanceMezzaninePlaceholder } = await import("@/lib/stream-encode-pipeline");
          const { isMediaConvertPlaceholderUid } = await import("@/lib/mediaconvert-mezzanine");
          const normalized = normalizeStorageMediaUrl(videoUrl) ?? videoUrl;
          const asset =
            (await findStreamAssetBySourceUrl(normalized)) ??
            (await findStreamAssetBySourceUrl(videoUrl));
          if (asset?.status?.toLowerCase() === "mezzanining" && isMediaConvertPlaceholderUid(asset.uid)) {
            await advanceMezzaninePlaceholder(asset.uid);
            return;
          }
          if (asset && isFailedStreamStatus(asset.status)) {
            await linkOrIngestStreamForUrl(videoUrl, "Content", id, {
              area: "admin-preview-reencode",
              source: "storytime-admin-preview-reencode",
            });
          }
        } catch (err) {
          console.error("admin playback-preview failed-stream reencode failed:", err);
        }
      });
    }

    return NextResponse.json({
      contentId: content.id,
      title: content.title,
      episodeTitle,
      isTrailer,
      posterUrl:
        (await packAdminImageUrl(content.posterUrl)) ??
        (await packAdminImageUrl(getDisplayPosterUrl(content))) ??
        getDisplayPosterUrl(content),
      playback,
    });
  } catch (err) {
    console.error("admin playback-preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 },
    );
  }
}
