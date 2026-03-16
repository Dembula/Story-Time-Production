import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

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

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const selections = await prisma.musicSelection.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    include: { track: true },
  });

  return NextResponse.json({ selections });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        trackId: string;
        usage?: string;
        notes?: string;
      }
    | null;

  if (!body?.trackId) {
    return NextResponse.json({ error: "Missing trackId" }, { status: 400 });
  }

  const track = await prisma.musicTrack.findUnique({
    where: { id: body.trackId },
  });
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const selection = await prisma.musicSelection.create({
    data: {
      projectId: params.projectId,
      trackId: body.trackId,
      usage: body.usage ?? null,
      notes: body.notes ?? null,
    },
    include: { track: true },
  });

  return NextResponse.json({ selection }, { status: 201 });
}
