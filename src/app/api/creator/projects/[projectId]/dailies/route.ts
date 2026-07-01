import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { Prisma } from "../../../../../../../generated/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { ensureLegacyClipsFromBatches } from "@/lib/dailies/build-intelligence-payload";
import { finalizeDailiesBatchStream } from "@/lib/dailies/finalize-clip-stream";
import {
  dailiesStreamStatusForUpload,
  inferDailiesMediaTypeFromUrl,
  type DailiesMediaType,
} from "@/lib/dailies/media";

function parseBatchMediaType(
  body: { mediaType?: string; metadata?: Record<string, unknown> } | null,
  videoUrl: string | null,
): DailiesMediaType {
  if (body?.mediaType === "still" || body?.mediaType === "video") return body.mediaType;
  const metaType = body?.metadata?.mediaType;
  if (metaType === "still" || metaType === "video") return metaType;
  return inferDailiesMediaTypeFromUrl(videoUrl);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  await ensureLegacyClipsFromBatches(projectId);

  const [batches, clips] = await Promise.all([
    prisma.dailiesBatch.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        scene: { select: { number: true, heading: true } },
        shootDay: { select: { id: true, date: true, unit: true } },
        reviewNotes: { orderBy: { createdAt: "desc" } },
        clips: { select: { id: true, title: true, takeStatus: true } },
      },
    }),
    prisma.dailiesClip.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        scene: { select: { number: true, heading: true } },
        shootDay: { select: { id: true, date: true } },
      },
    }),
  ]);

  return NextResponse.json({ batches, clips });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        sceneId?: string;
        shootDayId?: string;
        title?: string;
        videoUrl?: string;
        notes?: string;
        unit?: string;
        cameraCard?: string;
        shotNumber?: string;
        takeNumber?: number;
        camera?: string;
        lens?: string;
        metadata?: Record<string, unknown>;
        createClip?: boolean;
        mediaType?: string;
      }
    | null;

  const videoUrl = body?.videoUrl?.trim() || null;
  const videoErr = validateStorageUrlField(videoUrl, "videoUrl", { allowNull: true });
  if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });

  const mediaType = parseBatchMediaType(body, videoUrl);
  const streamStatus = dailiesStreamStatusForUpload(mediaType, !!videoUrl);

  const batch = await prisma.dailiesBatch.create({
    data: {
      projectId,
      sceneId: body?.sceneId ?? null,
      shootDayId: body?.shootDayId ?? null,
      title: body?.title ?? null,
      videoUrl,
      notes: body?.notes ?? null,
      unit: body?.unit ?? null,
      cameraCard: body?.cameraCard ?? null,
      uploadStatus: videoUrl ? "complete" : "uploading",
      metadata: body?.metadata ? (body.metadata as Prisma.InputJsonValue) : undefined,
    },
  });

  let clip = null;
  if (videoUrl || body?.createClip !== false) {
    clip = await prisma.dailiesClip.create({
      data: {
        projectId,
        batchId: batch.id,
        sceneId: body?.sceneId ?? null,
        shootDayId: body?.shootDayId ?? null,
        unit: body?.unit ?? null,
        title: body?.title ?? null,
        videoUrl,
        mediaType,
        streamStatus,
        shotNumber: body?.shotNumber ?? null,
        takeNumber: body?.takeNumber ?? null,
        camera: body?.camera ?? null,
        lens: body?.lens ?? null,
        metadata: body?.metadata ? (body.metadata as Prisma.InputJsonValue) : undefined,
        takeStatus: "pending",
      },
    });
  }

  if (videoUrl && mediaType === "video") {
    after(async () => {
      try {
        await finalizeDailiesBatchStream({
          batchId: batch.id,
          clipId: clip?.id ?? null,
          videoUrl,
          projectId,
        });
      } catch (err) {
        console.error("Dailies batch stream finalize failed:", err);
        if (clip) {
          await prisma.dailiesClip.update({
            where: { id: clip.id },
            data: { streamStatus: "ready" },
          });
        }
      }
    });
  }

  return NextResponse.json({ batch, clip }, { status: 201 });
}
