import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

const db = prisma as any;

type RouteCtx = { params: Promise<{ projectId: string; boardId: string }> };

async function loadBoard(projectId: string, boardId: string) {
  return db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
    include: {
      frames: { orderBy: { sortOrder: "asc" } },
      _count: { select: { frames: true, guestInvites: true } },
    },
  });
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const board = await loadBoard(projectId, boardId);
  if (!board) return NextResponse.json({ error: "Board not found." }, { status: 404 });
  return NextResponse.json({ board });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const existing = await db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Board not found." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        scriptKey?: string | null;
        scriptLabel?: string | null;
        stylePreset?: string;
        aspectRatio?: string;
        globalNotes?: string | null;
        status?: string;
        sortOrder?: number;
        frameOrder?: string[];
      }
    | null;

  if (Array.isArray(body?.frameOrder) && body.frameOrder.length > 0) {
    await prisma.$transaction(
      body.frameOrder.map((frameId, index) =>
        db.storyboardFrame.updateMany({
          where: { id: frameId, boardId, projectId },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  const board = await db.storyboardBoard.update({
    where: { id: boardId },
    data: {
      ...(body?.title != null ? { title: body.title.trim() || "Untitled storyboard" } : {}),
      ...(body?.scriptKey !== undefined ? { scriptKey: body.scriptKey?.trim() || null } : {}),
      ...(body?.scriptLabel !== undefined
        ? { scriptLabel: body.scriptLabel?.trim() || null }
        : {}),
      ...(body?.stylePreset ? { stylePreset: body.stylePreset.trim() } : {}),
      ...(body?.aspectRatio ? { aspectRatio: body.aspectRatio.trim() } : {}),
      ...(body?.globalNotes !== undefined
        ? { globalNotes: body.globalNotes?.trim() || null }
        : {}),
      ...(body?.status ? { status: body.status } : {}),
      ...(typeof body?.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
    },
    include: {
      frames: { orderBy: { sortOrder: "asc" } },
      _count: { select: { frames: true, guestInvites: true } },
    },
  });

  return NextResponse.json({ board });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { projectId, boardId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const existing = await db.storyboardBoard.findFirst({
    where: { id: boardId, projectId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Board not found." }, { status: 404 });

  await db.storyboardBoard.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
}
