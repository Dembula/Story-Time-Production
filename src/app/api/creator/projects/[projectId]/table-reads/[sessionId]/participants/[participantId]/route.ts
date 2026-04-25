import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string; sessionId: string; participantId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, sessionId, participantId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const existing = await prisma.tableReadParticipant.findFirst({
    where: { id: participantId, sessionId, session: { projectId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | { characterName?: string | null; guestName?: string | null }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: { characterName?: string | null; guestName?: string | null } = {};
  if ("characterName" in body) data.characterName = body.characterName?.trim() || null;
  if ("guestName" in body && existing.userId === null) {
    const g = body.guestName?.trim() ?? "";
    if (!g) {
      return NextResponse.json({ error: "guestName cannot be empty" }, { status: 400 });
    }
    data.guestName = g;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const participant = await prisma.tableReadParticipant.update({
    where: { id: participantId },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ participant });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId, sessionId, participantId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const existing = await prisma.tableReadParticipant.findFirst({
    where: { id: participantId, sessionId, session: { projectId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  await prisma.tableReadParticipant.delete({ where: { id: participantId } });
  return NextResponse.json({ ok: true });
}
