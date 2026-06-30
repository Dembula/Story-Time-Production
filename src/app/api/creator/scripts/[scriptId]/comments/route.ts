import { NextRequest, NextResponse } from "next/server";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ scriptId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const comments = await prisma.creatorScriptComment.findMany({
    where: { scriptId, parentId: null },
    include: {
      author: {
        select: { id: true, name: true, professionalName: true, image: true },
      },
      replies: {
        include: {
          author: {
            select: { id: true, name: true, professionalName: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  if (!gate.access.canComment) {
    return NextResponse.json({ error: "Read-only mode" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    body?: string;
    lineIndex?: number;
    sceneHeading?: string;
    parentId?: string;
  } | null;

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Comment body required" }, { status: 400 });
  }

  const comment = await prisma.creatorScriptComment.create({
    data: {
      scriptId,
      authorId: gate.access.userId,
      body: body.body.trim(),
      lineIndex: body.lineIndex ?? null,
      sceneHeading: body.sceneHeading?.trim() || null,
      parentId: body.parentId ?? null,
    },
    include: {
      author: {
        select: { id: true, name: true, professionalName: true, image: true },
      },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    resolved?: boolean;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing comment id" }, { status: 400 });
  }

  const existing = await prisma.creatorScriptComment.findFirst({
    where: { id: body.id, scriptId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comment = await prisma.creatorScriptComment.update({
    where: { id: body.id },
    data: { resolved: body.resolved ?? existing.resolved },
  });

  return NextResponse.json({ comment });
}
