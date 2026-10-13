import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";

const db = prisma as any;

type RouteCtx = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const boards = await db.storyboardBoard.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      frames: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sceneId: true,
          sceneNumber: true,
          sceneHeading: true,
          shotLabel: true,
          sortOrder: true,
          prompt: true,
          directorNotes: true,
          imageUrl: true,
          generationStatus: true,
          generationError: true,
          styleOverride: true,
          lastEditPrompt: true,
          updatedAt: true,
        },
      },
      _count: { select: { frames: true, guestInvites: true } },
    },
  });

  return NextResponse.json({ boards });
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        scriptKey?: string;
        scriptLabel?: string;
        stylePreset?: string;
        aspectRatio?: string;
        globalNotes?: string;
      }
    | null;

  const title = body?.title?.trim() || "Untitled storyboard";
  const count = await db.storyboardBoard.count({ where: { projectId } });

  const board = await db.storyboardBoard.create({
    data: {
      projectId,
      createdById: access.userId,
      title,
      scriptKey: body?.scriptKey?.trim() || null,
      scriptLabel: body?.scriptLabel?.trim() || null,
      stylePreset: body?.stylePreset?.trim() || "cinematic",
      aspectRatio: body?.aspectRatio?.trim() || "16:9",
      globalNotes: body?.globalNotes?.trim() || null,
      status: "DRAFT",
      sortOrder: count,
    },
    include: {
      frames: { orderBy: { sortOrder: "asc" } },
      _count: { select: { frames: true, guestInvites: true } },
    },
  });

  return NextResponse.json({ board }, { status: 201 });
}
