import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { analyzeFootageClip } from "@/lib/dailies/ai-footage-analysis";
import { finalizeDailiesClipStream } from "@/lib/dailies/finalize-clip-stream";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const shootDayId = req.nextUrl.searchParams.get("shootDayId");
  const sceneId = req.nextUrl.searchParams.get("sceneId");

  const clips = await prisma.dailiesClip.findMany({
    where: {
      projectId,
      ...(shootDayId ? { shootDayId } : {}),
      ...(sceneId ? { sceneId } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      scene: { select: { number: true, heading: true } },
      shootDay: { select: { date: true, unit: true } },
      notes: { where: { parentNoteId: null }, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json({ clips });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl.trim() : null;
  const videoErr = validateStorageUrlField(videoUrl, "videoUrl", { allowNull: true });
  if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });

  const clip = await prisma.dailiesClip.create({
    data: {
      projectId,
      batchId: typeof body?.batchId === "string" ? body.batchId : null,
      sceneId: typeof body?.sceneId === "string" ? body.sceneId : null,
      shootDayId: typeof body?.shootDayId === "string" ? body.shootDayId : null,
      unit: typeof body?.unit === "string" ? body.unit : null,
      title: typeof body?.title === "string" ? body.title : null,
      videoUrl,
      shotNumber: typeof body?.shotNumber === "string" ? body.shotNumber : null,
      takeNumber: typeof body?.takeNumber === "number" ? body.takeNumber : null,
      camera: typeof body?.camera === "string" ? body.camera : null,
      lens: typeof body?.lens === "string" ? body.lens : null,
      slate: typeof body?.slate === "string" ? body.slate : null,
      location: typeof body?.location === "string" ? body.location : null,
      sequence: typeof body?.sequence === "string" ? body.sequence : null,
      editorBin: typeof body?.editorBin === "string" ? body.editorBin : null,
      durationMs: typeof body?.durationMs === "number" ? body.durationMs : null,
      metadata:
        body?.metadata && typeof body.metadata === "object"
          ? (body.metadata as Prisma.InputJsonValue)
          : undefined,
      streamStatus: videoUrl ? "processing" : "pending",
      takeStatus: "pending",
    },
  });

  const aiAnalysis = analyzeFootageClip({
    clip: { title: clip.title, takeStatus: clip.takeStatus, takeFlags: [], metadata: clip.metadata, durationMs: clip.durationMs, notes: [] },
    sceneHeading: null,
    continuityNoteCount: 0,
  });

  await prisma.dailiesClip.update({
    where: { id: clip.id },
    data: { aiAnalysis: aiAnalysis as Prisma.InputJsonValue },
  });

  if (videoUrl) {
    after(async () => {
      try {
        await finalizeDailiesClipStream({ clipId: clip.id, videoUrl, projectId });
      } catch (err) {
        console.error("Dailies clip stream finalize failed:", err);
        await prisma.dailiesClip.update({
          where: { id: clip.id },
          data: { streamStatus: "ready" },
        });
      }
    });
  }

  return NextResponse.json({ clip }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        takeStatus?: string;
        takeFlags?: string[];
        title?: string;
        shotNumber?: string;
        takeNumber?: number;
        metadata?: Record<string, unknown>;
        editorBin?: string;
      }
    | null;

  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.dailiesClip.findFirst({
    where: { id: body.id, projectId },
  });
  if (!existing) return NextResponse.json({ error: "Clip not found" }, { status: 404 });

  const clip = await prisma.dailiesClip.update({
    where: { id: body.id },
    data: {
      ...(body.takeStatus != null ? { takeStatus: body.takeStatus } : {}),
      ...(body.takeFlags != null ? { takeFlags: body.takeFlags } : {}),
      ...(body.title != null ? { title: body.title } : {}),
      ...(body.shotNumber != null ? { shotNumber: body.shotNumber } : {}),
      ...(body.takeNumber != null ? { takeNumber: body.takeNumber } : {}),
      ...(body.metadata != null ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
      ...(body.editorBin != null ? { editorBin: body.editorBin } : {}),
    },
  });

  return NextResponse.json({ clip });
}
