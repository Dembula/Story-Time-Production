import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFailedStreamStatus, isReadyStreamStatus } from "@/lib/content-approve-publish";
import {
  isS3FallbackPlayback,
  resolveServerPlaybackSource,
} from "@/lib/server-playback-sources";
import {
  findStreamAssetBySourceUrl,
} from "@/lib/stream-asset-store";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
} from "@/lib/cloudflare-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

/** Masters browsers can usually decode without Stream (H.264/AAC in MP4/WebM). */
function isBrowserSafeProgressive(fileUrl: string): boolean {
  return /\.(mp4|webm|m4v)(\?|$)/i.test(fileUrl);
}

function parseAssetMeta(raw: string | null): {
  hlsUrl?: string;
  playbackUrl?: string;
  proxyUrl?: string;
  thumbnailUrl?: string;
  streamUid?: string;
  streamStatus?: string;
} {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function findStreamForFootage(assetId: string, fileUrl: string) {
  const byEntity = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "status", "playbackUrl", "hlsUrl", "iframeUrl"
    FROM "StreamAsset"
    WHERE "entityType" = 'FootageAsset' AND "entityId" = ${assetId}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `) as Array<{
    uid: string;
    sourceUrl: string | null;
    status: string | null;
    playbackUrl: string | null;
    hlsUrl: string | null;
    iframeUrl: string | null;
  }>;
  if (byEntity[0]) return byEntity[0];
  return (
    (await findStreamAssetBySourceUrl(fileUrl)) ??
    (await findStreamAssetBySourceUrl(fileUrl.trim()))
  );
}

/**
 * Resolve browser-playable media for an edit / footage asset.
 * Prefers signed Cloudflare Stream HLS (same path as admin review),
 * then browser-safe progressive MP4, else reports encoding-in-progress.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const assetId = req.nextUrl.searchParams.get("assetId")?.trim();
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const asset = await prisma.footageAsset.findFirst({
    where: { id: assetId, projectId },
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const meta = parseAssetMeta(asset.metadata);
  const stream = await findStreamForFootage(asset.id, asset.fileUrl);
  const streamStatus = stream?.status ?? meta.streamStatus ?? null;
  const streamReady = isReadyStreamStatus(streamStatus);
  const streamFailed = isFailedStreamStatus(streamStatus);

  // Prefer Stream HLS URL from linked asset or metadata
  let candidateUrl =
    (streamReady ? stream?.hlsUrl || stream?.playbackUrl : null) ||
    meta.hlsUrl?.trim() ||
    meta.playbackUrl?.trim() ||
    meta.proxyUrl?.trim() ||
    null;

  // If we only have a Stream UID, build HLS URL
  const uid =
    stream?.uid ||
    meta.streamUid ||
    (candidateUrl ? extractCloudflareStreamUid(candidateUrl) : null) ||
    extractCloudflareStreamUid(asset.fileUrl);
  if (!candidateUrl && uid && streamReady) {
    const cfg = getCloudflareStreamConfig();
    const urls = buildCloudflarePlaybackUrls(
      uid,
      cfg?.customerSubdomain ?? "https://videodelivery.net",
    );
    candidateUrl = urls.hlsUrl;
  }

  // Resolve signed HLS / signed S3 through the shared server path
  let playback = candidateUrl
    ? await resolveServerPlaybackSource(candidateUrl).catch(() => null)
    : null;

  if (!playback?.src) {
    playback = await resolveServerPlaybackSource(asset.fileUrl).catch(() => null);
  }

  // Kick / recover Stream ingest in the background
  after(async () => {
    try {
      const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
      const shouldRecover =
        !stream ||
        streamFailed ||
        (!streamReady && isS3FallbackPlayback(playback)) ||
        !streamReady;
      if (shouldRecover) {
        await linkOrIngestStreamForUrl(asset.fileUrl, "FootageAsset", asset.id, {
          area: "edit-review-playback",
          projectId,
          source: "storytime-edit-review-recovery",
          ...(streamFailed ? { forceMezzanine: "1" } : {}),
        });
      }
    } catch (err) {
      console.error("edit-review playback stream recovery failed:", err);
    }
  });

  const progressiveUnsafe =
    isS3FallbackPlayback(playback) && !isBrowserSafeProgressive(asset.fileUrl);

  // Waiting on encode: ProRes/MOV/MXF masters often load duration but paint black
  if ((!playback?.src || progressiveUnsafe) && !streamReady && !streamFailed) {
    return NextResponse.json({
      status: "encoding",
      streamStatus: streamStatus ?? "queued",
      message:
        "This edit is still encoding for browser playback. Upload an H.264 MP4 for instant review, or wait for streaming to finish.",
      playback: null,
      asset: {
        id: asset.id,
        label: asset.label,
        fileUrl: asset.fileUrl,
      },
      posterUrl: meta.thumbnailUrl ?? null,
    });
  }

  if (streamFailed && (!playback?.src || progressiveUnsafe)) {
    return NextResponse.json({
      status: "failed",
      streamStatus,
      message:
        "Streaming encode failed. Re-upload as an H.264 MP4, or try again — we are retrying encode in the background.",
      playback: null,
      asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
      posterUrl: meta.thumbnailUrl ?? null,
    });
  }

  if (!playback?.src || progressiveUnsafe) {
    return NextResponse.json({
      status: "unavailable",
      streamStatus,
      message:
        "This file format cannot play in the browser yet. Prefer H.264 MP4, or wait for streaming encode.",
      playback: null,
      asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
      posterUrl: meta.thumbnailUrl ?? null,
    });
  }

  // Persist resolved Stream URLs onto footage metadata when ready
  if (streamReady && stream?.hlsUrl && !meta.hlsUrl) {
    after(async () => {
      try {
        const next = {
          ...meta,
          hlsUrl: stream.hlsUrl,
          playbackUrl: stream.playbackUrl ?? stream.hlsUrl,
          proxyUrl: stream.playbackUrl ?? stream.hlsUrl,
          streamUid: stream.uid,
          streamStatus: stream.status,
        };
        await prisma.footageAsset.update({
          where: { id: asset.id },
          data: { metadata: JSON.stringify(next) },
        });
      } catch {
        /* ignore */
      }
    });
  }

  return NextResponse.json({
    status: "ready",
    streamStatus: streamStatus ?? (isS3FallbackPlayback(playback) ? "s3" : "ready"),
    playback: {
      src: playback.src,
      type: playback.type,
    },
    asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
    posterUrl: meta.thumbnailUrl ?? null,
  });
}
