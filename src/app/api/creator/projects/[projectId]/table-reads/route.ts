import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const sessions = await prisma.tableReadSession.findMany({
    where: { projectId },
    orderBy: { scheduledAt: "desc" },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      notes: true,
      scriptVersion: { select: { id: true, versionLabel: true, createdAt: true } },
    },
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string | null;
        scheduledAt?: string | null;
        scriptVersionId?: string | null;
        participantIds?: string[];
        characterNames?: Record<string, string>;
      }
    | null;

  const session = await prisma.tableReadSession.create({
    data: {
      projectId,
      name: body?.name ?? null,
      scheduledAt: body?.scheduledAt ? new Date(body.scheduledAt) : null,
      scriptVersionId: body?.scriptVersionId ?? null,
      createdById: userId,
    },
  });

  const participantIds = body?.participantIds ?? [];
  const characterNames = body?.characterNames ?? {};
  for (const uid of participantIds) {
    await prisma.tableReadParticipant.create({
      data: {
        sessionId: session.id,
        userId: uid,
        characterName: characterNames[uid] ?? null,
      },
    });
  }

  const created = await prisma.tableReadSession.findUnique({
    where: { id: session.id },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      scriptVersion: true,
    },
  });

  return NextResponse.json({ session: created }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        name?: string | null;
        scheduledAt?: string | null;
        scriptVersionId?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.tableReadSession.findFirst({
    where: { id: body.id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const session = await prisma.tableReadSession.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.scheduledAt !== undefined
        ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }
        : {}),
      ...(body.scriptVersionId !== undefined ? { scriptVersionId: body.scriptVersionId } : {}),
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      notes: true,
      scriptVersion: true,
    },
  });

  return NextResponse.json({ session });
}
