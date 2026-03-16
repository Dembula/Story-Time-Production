import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const sceneId = searchParams.get("sceneId");
  const shootDayId = searchParams.get("shootDayId");

  const notes = await prisma.continuityNote.findMany({
    where: {
      projectId,
      ...(sceneId ? { sceneId } : {}),
      ...(shootDayId ? { shootDayId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        sceneId?: string;
        shootDayId?: string;
        body: string;
        photoUrls?: string;
      }
    | null;

  if (!body?.body) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const note = await prisma.continuityNote.create({
    data: {
      projectId,
      sceneId: body.sceneId ?? null,
      shootDayId: body.shootDayId ?? null,
      body: body.body,
      photoUrls: body.photoUrls ?? null,
      createdById: userId,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
