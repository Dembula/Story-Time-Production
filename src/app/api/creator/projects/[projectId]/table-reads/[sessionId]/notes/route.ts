import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId, sessionId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const session = await prisma.tableReadSession.findFirst({
    where: { id: sessionId, projectId },
    include: { notes: { include: { user: { select: { id: true, name: true } } } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({ notes: session.notes });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, sessionId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const session = await prisma.tableReadSession.findFirst({
    where: { id: sessionId, projectId },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { body: string } | null;

  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const note = await prisma.tableReadNote.create({
    data: {
      sessionId,
      userId,
      body: body.body.trim(),
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
