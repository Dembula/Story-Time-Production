import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { reviseStoryboardPrompt } from "@/lib/storyboard/plan-shots";
import {
  generateStoryboardImageWithFallback,
  persistStoryboardImage,
} from "@/lib/storyboard/image-gen";

const db = prisma as any;

type RouteCtx = {
  params: Promise<{ projectId: string; boardId: string; frameId: string }>;
};

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId, frameId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const frame = await db.storyboardFrame.findFirst({
    where: { id: frameId, boardId, projectId },
    include: { board: { select: { stylePreset: true, aspectRatio: true } } },
  });
  if (!frame) return NextResponse.json({ error: "Frame not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | {
        prompt?: string;
        directorNotes?: string | null;
        shotLabel?: string;
        styleOverride?: string | null;
        editInstruction?: string;
        regenerate?: boolean;
      }
    | null;

  let nextPrompt = body?.prompt?.trim() || frame.prompt;
  let lastEditPrompt = frame.lastEditPrompt as string | null;
  let reviseModel: string | null = null;

  if (body?.editInstruction?.trim()) {
    const revised = await reviseStoryboardPrompt({
      currentPrompt: nextPrompt,
      editInstruction: body.editInstruction.trim(),
      stylePreset: body.styleOverride || frame.styleOverride || frame.board.stylePreset,
      sceneHeading: frame.sceneHeading,
    });
    nextPrompt = revised.prompt;
    lastEditPrompt = body.editInstruction.trim();
    reviseModel = revised.modelUsed;
  }

  let imageUrl = frame.imageUrl as string | null;
  let imageStorageRef = frame.imageStorageRef as string | null;
  let generationStatus = frame.generationStatus as string;
  let generationError = frame.generationError as string | null;

  if (body?.regenerate || body?.editInstruction?.trim()) {
    generationStatus = "GENERATING";
    await db.storyboardFrame.update({
      where: { id: frameId },
      data: {
        prompt: nextPrompt,
        lastEditPrompt,
        generationStatus: "GENERATING",
        generationError: null,
        ...(body?.directorNotes !== undefined
          ? { directorNotes: body.directorNotes?.trim() || null }
          : {}),
        ...(body?.shotLabel != null ? { shotLabel: body.shotLabel.trim() } : {}),
        ...(body?.styleOverride !== undefined
          ? { styleOverride: body.styleOverride?.trim() || null }
          : {}),
      },
    });

    try {
      const image = await generateStoryboardImageWithFallback({
        prompt: nextPrompt,
        aspectRatio: frame.board.aspectRatio,
      });
      const stored = await persistStoryboardImage({
        userId: access.userId,
        buffer: image.buffer,
        contentType: image.contentType,
        fileStem: `storyboard-frame-${frameId.slice(0, 10)}`,
      });
      imageUrl = stored.storageUrl;
      imageStorageRef = stored.storageRef;
      generationStatus = "READY";
      generationError = null;
    } catch (e) {
      generationStatus = "FAILED";
      generationError = e instanceof Error ? e.message : "Generation failed";
    }
  }

  const updated = await db.storyboardFrame.update({
    where: { id: frameId },
    data: {
      prompt: nextPrompt,
      lastEditPrompt,
      imageUrl,
      imageStorageRef,
      generationStatus,
      generationError,
      ...(body?.directorNotes !== undefined && !body?.regenerate && !body?.editInstruction
        ? { directorNotes: body.directorNotes?.trim() || null }
        : {}),
      ...(body?.shotLabel != null && !body?.regenerate && !body?.editInstruction
        ? { shotLabel: body.shotLabel.trim() }
        : {}),
      ...(body?.styleOverride !== undefined && !body?.regenerate && !body?.editInstruction
        ? { styleOverride: body.styleOverride?.trim() || null }
        : {}),
    },
  });

  return NextResponse.json({ frame: updated, reviseModelUsed: reviseModel });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId, frameId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const existing = await db.storyboardFrame.findFirst({
    where: { id: frameId, boardId, projectId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Frame not found." }, { status: 404 });

  await db.storyboardFrame.delete({ where: { id: frameId } });
  return NextResponse.json({ ok: true });
}
