import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { planStoryboardShots } from "@/lib/storyboard/plan-shots";
import {
  generateStoryboardImageWithFallback,
  persistStoryboardImage,
} from "@/lib/storyboard/image-gen";

const db = prisma as any;

type RouteCtx = { params: Promise<{ projectId: string; boardId: string }> };

async function loadScriptExcerpt(scriptKey: string | null | undefined): Promise<string | null> {
  if (!scriptKey) return null;
  if (scriptKey.startsWith("project-version:")) {
    const versionId = scriptKey.slice("project-version:".length);
    const version = await db.projectScriptVersion.findUnique({
      where: { id: versionId },
      select: { content: true },
    });
    return version?.content ?? null;
  }
  if (scriptKey.startsWith("creator-script:")) {
    const scriptId = scriptKey.slice("creator-script:".length);
    const script = await db.creatorScript.findUnique({
      where: { id: scriptId },
      select: { content: true },
    });
    return script?.content ?? null;
  }
  return null;
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const board = await db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
  });
  if (!board) return NextResponse.json({ error: "Board not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { shotsPerScene?: number; regenerateExisting?: boolean }
    | null;

  const scenes = await db.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, heading: true, summary: true },
  });

  if (scenes.length === 0) {
    return NextResponse.json(
      {
        error:
          "No project scenes yet. Sync scenes from your script in Script Breakdown Studio first.",
      },
      { status: 400 },
    );
  }

  await db.storyboardBoard.update({
    where: { id: boardId },
    data: { status: "GENERATING" },
  });

  try {
    const scriptExcerpt = await loadScriptExcerpt(board.scriptKey);
    const planned = await planStoryboardShots({
      title: board.title,
      stylePreset: board.stylePreset,
      aspectRatio: board.aspectRatio,
      scenes,
      scriptExcerpt,
      globalNotes: board.globalNotes,
      shotsPerScene: body?.shotsPerScene ?? 1,
    });

    if (body?.regenerateExisting) {
      await db.storyboardFrame.deleteMany({ where: { boardId } });
    } else {
      const existingCount = await db.storyboardFrame.count({ where: { boardId } });
      if (existingCount > 0) {
        return NextResponse.json(
          { error: "Board already has frames. Pass regenerateExisting to rebuild." },
          { status: 409 },
        );
      }
    }

    const sceneByNumber = new Map(scenes.map((s: { number: string; id: string }) => [s.number, s]));
    const createdFrames = [];

    for (let i = 0; i < planned.shots.length; i++) {
      const shot = planned.shots[i];
      const matched =
        (shot.sceneId && scenes.find((s: { id: string }) => s.id === shot.sceneId)) ||
        sceneByNumber.get(shot.sceneNumber) ||
        null;

      const frame = await db.storyboardFrame.create({
        data: {
          boardId,
          projectId,
          sceneId: matched?.id ?? null,
          sceneNumber: shot.sceneNumber,
          sceneHeading: shot.sceneHeading,
          shotLabel: shot.shotLabel,
          sortOrder: i,
          prompt: shot.prompt,
          directorNotes: shot.directorNotes ?? null,
          generationStatus: "GENERATING",
        },
      });

      try {
        const image = await generateStoryboardImageWithFallback({
          prompt: shot.prompt,
          aspectRatio: board.aspectRatio,
        });
        const stored = await persistStoryboardImage({
          userId: access.userId,
          buffer: image.buffer,
          contentType: image.contentType,
          fileStem: `storyboard-${boardId.slice(0, 8)}-${frame.id.slice(0, 8)}`,
        });
        const updated = await db.storyboardFrame.update({
          where: { id: frame.id },
          data: {
            imageUrl: stored.storageUrl,
            imageStorageRef: stored.storageRef,
            generationStatus: "READY",
            generationError: null,
          },
        });
        createdFrames.push(updated);
      } catch (e) {
        const updated = await db.storyboardFrame.update({
          where: { id: frame.id },
          data: {
            generationStatus: "FAILED",
            generationError: e instanceof Error ? e.message : "Generation failed",
          },
        });
        createdFrames.push(updated);
      }
    }

    const readyCount = createdFrames.filter((f: { generationStatus: string }) => f.generationStatus === "READY").length;
    const updatedBoard = await db.storyboardBoard.update({
      where: { id: boardId },
      data: { status: readyCount > 0 ? "READY" : "DRAFT" },
      include: {
        frames: { orderBy: { sortOrder: "asc" } },
        _count: { select: { frames: true, guestInvites: true } },
      },
    });

    return NextResponse.json({
      board: updatedBoard,
      planModelUsed: planned.modelUsed,
      generated: readyCount,
      failed: createdFrames.length - readyCount,
    });
  } catch (e) {
    await db.storyboardBoard.update({
      where: { id: boardId },
      data: { status: "DRAFT" },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Storyboard generation failed." },
      { status: 500 },
    );
  }
}
