import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFailedStreamStatus, isReadyStreamStatus } from "@/lib/content-approve-publish";
import { resolveServerPlaybackSource } from "@/lib/server-playback-sources";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
} from "@/lib/cloudflare-stream";
import { buildSecureFilePreviewPath } from "@/lib/secure-file-preview-path";
import { isPlatformStorageReference } from "@/lib/secure-file-access";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";

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

  if (role === "ADMIN") {
    return { error: null as NextResponse | null, userId };
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

/** Extensions browsers can usually decode progressively (H.264/AAC in MP4, WebM). */
function isBrowserSafeProgressive(fileUrl: string): boolean {
  return /\.(mp4|webm|m4v)(\?|$)/i.test(fileUrl);
}

function isLikelyCameraMaster(fileUrl: string): boolean {
  return /\.(mov|mkv|avi|mxf|prores|r3d|braw)(\?|$)/i.test(fileUrl);
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
  try {
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
  } catch (err) {
    console.error("findStreamForFootage entity lookup failed", err);
  }
  try {
    return await findStreamAssetBySourceUrl(fileUrl);
  } catch (err) {
    console.error("findStreamForFootage source lookup failed", err);
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function previewPlayback(fileUrl: string, projectId: string) {
  if (!isPlatformStorageReference(fileUrl)) {
    return { src: fileUrl, type: "video/mp4" as const };
  }
  return {
    src: buildSecureFilePreviewPath(fileUrl, { projectId }),
    type: "video/mp4" as const,
  };
}

async function signedS3Playback(fileUrl: string) {
  const ref = resolveStorageObjectRef(fileUrl);
  if (!ref) return null;
  try {
    const url = await getStorageObjectSignedUrl(ref, 60 * 60);
    return { src: url, type: "video/mp4" as const };
  } catch {
    return null;
  }
}

/**
 * Resolve browser-playable media for an edit / footage asset.
 * Never pretends a ProRes/MOV master is ready — wait for Stream HLS.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
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
    if (!asset?.fileUrl?.trim()) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const meta = parseAssetMeta(asset.metadata);
    const stream = await findStreamForFootage(asset.id, asset.fileUrl);
    const streamStatus = stream?.status ?? meta.streamStatus ?? null;
    const streamReady = isReadyStreamStatus(streamStatus);
    const streamFailed = isFailedStreamStatus(streamStatus);
    const safeMaster = isBrowserSafeProgressive(asset.fileUrl);
    const cameraMaster = isLikelyCameraMaster(asset.fileUrl);

    let candidateUrl =
      (streamReady ? stream?.hlsUrl || stream?.playbackUrl || meta.hlsUrl : null) ||
      (meta.hlsUrl?.trim() && streamReady ? meta.hlsUrl.trim() : null) ||
      null;

    // If Stream isn't marked ready but metadata already has HLS, still try it.
    if (!candidateUrl && meta.hlsUrl?.trim()) {
      candidateUrl = meta.hlsUrl.trim();
    }
    if (!candidateUrl && stream?.hlsUrl) {
      candidateUrl = stream.hlsUrl;
    }

    const uid =
      stream?.uid ||
      meta.streamUid ||
      (candidateUrl ? extractCloudflareStreamUid(candidateUrl) : null);
    if (!candidateUrl && uid) {
      const cfg = getCloudflareStreamConfig();
      candidateUrl = buildCloudflarePlaybackUrls(
        uid,
        cfg?.customerSubdomain ?? "https://videodelivery.net",
      ).hlsUrl;
    }

    // Background Stream recovery (never blocks response)
    after(async () => {
      try {
        const { linkOrIngestStreamForUrl } = await import("@/lib/stream-ingest-link");
        if (!streamReady) {
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

    let playback: { src: string; type: string } | null = null;

    // 1) Prefer signed Stream / HLS whenever we have a candidate
    if (candidateUrl) {
      playback = await withTimeout(resolveServerPlaybackSource(candidateUrl), 8_000);
    }
    if (!playback?.src && (streamReady || uid)) {
      playback = await withTimeout(resolveServerPlaybackSource(asset.fileUrl), 8_000);
    }

    const isHls =
      !!playback?.src &&
      (playback.type.includes("mpegurl") ||
        /\.m3u8(\?|$)/i.test(playback.src) ||
        playback.src.includes("videodelivery.net") ||
        playback.src.includes("cloudflarestream.com"));

    // 2) Browser-safe progressive (H.264 MP4 / WebM) — play immediately
    if (!playback?.src && safeMaster) {
      playback =
        (await withTimeout(signedS3Playback(asset.fileUrl), 5_000)) ??
        previewPlayback(asset.fileUrl, projectId);
    }

    // 3) Unknown extension on platform storage — try signed S3 (may still be H.264)
    if (!playback?.src && !cameraMaster && isPlatformStorageReference(asset.fileUrl)) {
      playback =
        (await withTimeout(signedS3Playback(asset.fileUrl), 5_000)) ??
        previewPlayback(asset.fileUrl, projectId);
    }

    // Camera masters (.mov etc.): NEVER serve progressive as "ready" — browsers can't decode ProRes.
    if (cameraMaster && !isHls) {
      return NextResponse.json({
        status: streamFailed ? "failed" : "encoding",
        streamStatus: streamStatus ?? "queued",
        playable: false,
        message: streamFailed
          ? "Streaming encode failed. Re-upload an H.264 MP4 for browser review."
          : "Preparing stream playback for this master… Export H.264 MP4 from your NLE for instant review.",
        playback: null,
        asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
        posterUrl: meta.thumbnailUrl ?? null,
      });
    }

    if (!playback?.src) {
      return NextResponse.json({
        status: streamFailed ? "failed" : "encoding",
        streamStatus: streamStatus ?? "queued",
        playable: false,
        message: streamFailed
          ? "Streaming encode failed. Re-upload as an H.264 MP4."
          : "Preparing playback… Prefer H.264 MP4 for instant review.",
        playback: null,
        asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
        posterUrl: meta.thumbnailUrl ?? null,
      });
    }

    return NextResponse.json({
      status: "ready",
      streamStatus: streamStatus ?? (isHls ? "ready" : "progressive"),
      playable: true,
      message: isHls
        ? undefined
        : safeMaster
          ? undefined
          : "Playing original file. If picture is black, wait for stream encode or upload H.264 MP4.",
      playback: {
        src: playback.src,
        type: isHls ? "application/vnd.apple.mpegurl" : playback.type,
      },
      asset: { id: asset.id, label: asset.label, fileUrl: asset.fileUrl },
      posterUrl: meta.thumbnailUrl ?? null,
    });
  } catch (error) {
    console.error("edit-review playback route failed", error);
    return NextResponse.json(
      { error: "Could not resolve playback", status: "unavailable", playback: null, playable: false },
      { status: 500 },
    );
  }
}
