import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../../../../generated/prisma";
import { getCloudflareStreamVideoDetails } from "@/lib/cloudflare-stream";
import {
  isMediaConvertPlaceholderUid,
  mediaConvertJobIdFromPlaceholderUid,
  pollStreamMezzanineJob,
} from "@/lib/mediaconvert-mezzanine";
import { advanceMezzaninePlaceholder } from "@/lib/stream-encode-pipeline";
import { isFailedStreamStatus, isReadyStreamStatus } from "@/lib/content-approve-publish";
import { getStreamAssetsByUrls } from "@/lib/stream-asset-store";
import { storageMediaLookupKeys } from "@/lib/pack-storage-media-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

type EncodePhase = "none" | "compressing" | "encoding" | "ready" | "error" | "queued";

function parseCompressPercent(lastError: string | null | undefined): number | null {
  if (!lastError) return null;
  const m = lastError.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

async function buildAssetStatus(label: string, sourceUrl: string | null | undefined) {
  const url = sourceUrl?.trim() || null;
  if (!url) {
    return {
      label,
      sourceUrl: null,
      uid: null,
      status: null,
      phase: "none" as EncodePhase,
      compressPercent: null as number | null,
      encodePercent: null as number | null,
      message: "No file uploaded",
    };
  }

  const map = await getStreamAssetsByUrls([url]);
  let asset = map.get(url) ?? null;

  const keys = storageMediaLookupKeys(url);
  const lookup = keys.length > 0 ? keys : [url];
  const rows = (await prisma.$queryRaw`
    SELECT "uid", "sourceUrl", "status", "lastError", "playbackUrl", "hlsUrl", "iframeUrl"
    FROM "StreamAsset"
    WHERE "sourceUrl" IN (${Prisma.join(lookup)})
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `) as Array<{
    uid: string;
    sourceUrl: string | null;
    status: string | null;
    lastError: string | null;
    playbackUrl: string | null;
    hlsUrl: string | null;
    iframeUrl: string | null;
  }>;
  const row = rows[0];
  if (row) {
    asset = {
      uid: row.uid,
      sourceUrl: row.sourceUrl,
      status: row.status,
      playbackUrl: row.playbackUrl,
      hlsUrl: row.hlsUrl,
      iframeUrl: row.iframeUrl,
    };
  }

  if (!asset) {
    return {
      label,
      sourceUrl: url,
      uid: null,
      status: null,
      phase: "queued" as EncodePhase,
      compressPercent: null,
      encodePercent: null,
      message: "Waiting for encode pipeline",
    };
  }

  const status = (asset.status || "").toLowerCase();
  const lastError = row?.lastError ?? null;

  if (isReadyStreamStatus(status)) {
    return {
      label,
      sourceUrl: url,
      uid: asset.uid,
      status: asset.status,
      phase: "ready" as EncodePhase,
      compressPercent: 100,
      encodePercent: 100,
      message: "Ready for playback",
    };
  }

  if (isFailedStreamStatus(status)) {
    return {
      label,
      sourceUrl: url,
      uid: asset.uid,
      status: asset.status,
      phase: "error" as EncodePhase,
      compressPercent: null,
      encodePercent: null,
      message: lastError || "Encode failed",
    };
  }

  if (status === "mezzanining" && isMediaConvertPlaceholderUid(asset.uid)) {
    try {
      await advanceMezzaninePlaceholder(asset.uid);
    } catch (err) {
      console.error("encode-status mezzanine advance failed:", err);
    }

    const jobId = mediaConvertJobIdFromPlaceholderUid(asset.uid);
    let compressPercent = parseCompressPercent(lastError);
    let message = lastError || "Compressing mezzanine for Stream…";
    if (jobId) {
      try {
        const polled = await pollStreamMezzanineJob(jobId);
        if (polled.status === "COMPLETE") {
          // Advance may still be finishing Stream ingest — report as encoding handoff.
          return {
            label,
            sourceUrl: url,
            uid: asset.uid,
            status: "mezzanining",
            phase: "encoding" as EncodePhase,
            compressPercent: 100,
            encodePercent: 0,
            message: "Compress done — starting Stream encode…",
          };
        }
        if (polled.status === "ERROR") {
          return {
            label,
            sourceUrl: url,
            uid: asset.uid,
            status: "error",
            phase: "error" as EncodePhase,
            compressPercent: compressPercent,
            encodePercent: null,
            message: polled.message,
          };
        }
        if (typeof polled.progress === "number") {
          compressPercent = Math.round(polled.progress);
          message = `Compressing mezzanine… ${compressPercent}%`;
        }
      } catch (err) {
        console.error("encode-status MediaConvert poll failed:", err);
      }
    }

    return {
      label,
      sourceUrl: url,
      uid: asset.uid,
      status: asset.status,
      phase: "compressing" as EncodePhase,
      compressPercent,
      encodePercent: null,
      message,
    };
  }

  // Real Cloudflare Stream asset still processing
  if (!isMediaConvertPlaceholderUid(asset.uid)) {
    try {
      const details = await getCloudflareStreamVideoDetails(asset.uid);
      if (details) {
        const encodePercent =
          details.readyToStream || isReadyStreamStatus(details.state)
            ? 100
            : details.pctComplete;
        const phase: EncodePhase =
          details.readyToStream || isReadyStreamStatus(details.state)
            ? "ready"
            : details.state?.toLowerCase() === "error"
              ? "error"
              : "encoding";
        return {
          label,
          sourceUrl: url,
          uid: asset.uid,
          status: details.state,
          phase,
          compressPercent: 100,
          encodePercent,
          message:
            phase === "ready"
              ? "Ready for playback"
              : phase === "error"
                ? details.errorReasonText || "Stream encode failed"
                : `Stream ${details.state}${encodePercent != null ? `… ${Math.round(encodePercent)}%` : ""}`,
        };
      }
    } catch (err) {
      console.error("encode-status Stream details failed:", err);
    }
  }

  return {
    label,
    sourceUrl: url,
    uid: asset.uid,
    status: asset.status,
    phase: "encoding" as EncodePhase,
    compressPercent: status === "mezzanining" ? parseCompressPercent(lastError) : 100,
    encodePercent: null,
    message: lastError || `Stream status: ${asset.status || "processing"}`,
  };
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const content = await prisma.content.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      trailerUrl: true,
      seasons: {
        orderBy: { seasonNumber: "asc" },
        select: {
          seasonNumber: true,
          episodes: {
            orderBy: { episodeNumber: "asc" },
            select: { episodeNumber: true, title: true, videoUrl: true },
          },
        },
      },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assets = [
    await buildAssetStatus("Main video", content.videoUrl),
    await buildAssetStatus("Trailer", content.trailerUrl),
  ];

  for (const season of content.seasons) {
    for (const ep of season.episodes) {
      if (!ep.videoUrl) continue;
      assets.push(
        await buildAssetStatus(`S${season.seasonNumber}E${ep.episodeNumber} ${ep.title}`, ep.videoUrl),
      );
    }
  }

  return NextResponse.json({
    ok: true,
    contentId: content.id,
    title: content.title,
    assets,
  });
}
