import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";

interface Params {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, sessionId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const session = await prisma.tableReadSession.findFirst({
    where: { id: sessionId, projectId },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | { guestName?: string | null; userId?: string | null; characterName?: string | null }
    | null;

  const guestName = body?.guestName?.trim() ?? "";
  const userId = body?.userId?.trim() ?? "";
  const characterName = body?.characterName?.trim() || null;

  if (!guestName && !userId) {
    return NextResponse.json({ error: "Provide guestName or userId" }, { status: 400 });
  }
  if (guestName && userId) {
    return NextResponse.json({ error: "Use either guestName or userId, not both" }, { status: 400 });
  }

  if (userId) {
    const participant = await prisma.tableReadParticipant.create({
      data: {
        sessionId,
        userId,
        guestName: null,
        characterName,
      } as any,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ participant }, { status: 201 });
  }

  const participant = await prisma.tableReadParticipant.create({
    data: {
      sessionId,
      userId: null,
      guestName,
      characterName,
    } as any,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ participant }, { status: 201 });
}
