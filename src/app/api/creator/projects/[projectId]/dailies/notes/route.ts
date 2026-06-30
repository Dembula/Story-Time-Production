import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const clipId = req.nextUrl.searchParams.get("clipId");
  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!clipId && !batchId) {
    return NextResponse.json({ error: "clipId or batchId required" }, { status: 400 });
  }

  if (clipId) {
    const clip = await prisma.dailiesClip.findFirst({ where: { id: clipId, projectId } });
    if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const notes = await prisma.dailiesNote.findMany({
    where: {
      ...(clipId ? { clipId } : {}),
      ...(batchId ? { batchId } : {}),
      parentNoteId: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      replies: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  return NextResponse.json({
    notes: notes.map((n) => ({
      id: n.id,
      clipId: n.clipId,
      batchId: n.batchId,
      body: n.body,
      timestampMs: n.timestampMs,
      frameNumber: n.frameNumber,
      department: n.department,
      priority: n.priority,
      status: n.status,
      category: n.category,
      resolved: n.resolved,
      drawings: n.drawings,
      createdAt: n.createdAt.toISOString(),
      reviewerName: n.user?.name ?? n.user?.email ?? null,
      replies: n.replies.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        reviewerName: r.user?.name ?? r.user?.email ?? null,
      })),
    })),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;
  const userId = access.userId;

  const body = (await req.json().catch(() => null)) as
    | {
        batchId?: string;
        clipId?: string;
        body: string;
        timestampMs?: number;
        frameNumber?: number;
        department?: string;
        priority?: string;
        category?: string;
        drawings?: unknown;
        parentNoteId?: string;
      }
    | null;

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }
  if (!body.clipId && !body.batchId) {
    return NextResponse.json({ error: "clipId or batchId required" }, { status: 400 });
  }

  if (body.clipId) {
    const clip = await prisma.dailiesClip.findFirst({
      where: { id: body.clipId, projectId },
    });
    if (!clip) return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (body.batchId) {
    const batch = await prisma.dailiesBatch.findFirst({
      where: { id: body.batchId, projectId },
    });
    if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const note = await prisma.dailiesNote.create({
    data: {
      batchId: body.batchId ?? null,
      clipId: body.clipId ?? null,
      userId,
      body: body.body.trim(),
      timestampMs: body.timestampMs ?? null,
      frameNumber: body.frameNumber ?? null,
      department: body.department ?? null,
      priority: body.priority ?? "normal",
      category: body.category ?? null,
      drawings: body.drawings ?? undefined,
      parentNoteId: body.parentNoteId ?? null,
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => null)) as
    | { id: string; resolved?: boolean; status?: string; body?: string }
    | null;

  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.dailiesNote.findFirst({
    where: { id: body.id },
    include: { clip: { select: { projectId: true } }, batch: { select: { projectId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  const noteProjectId = existing.clip?.projectId ?? existing.batch?.projectId;
  if (noteProjectId !== projectId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const note = await prisma.dailiesNote.update({
    where: { id: body.id },
    data: {
      ...(body.resolved != null ? { resolved: body.resolved, status: body.resolved ? "resolved" : "open" } : {}),
      ...(body.status != null ? { status: body.status } : {}),
      ...(body.body != null ? { body: body.body } : {}),
    },
  });

  return NextResponse.json({ note });
}
