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
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const callSheets = await prisma.callSheet.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { shootDay: true },
  });

  return NextResponse.json({ callSheets });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        shootDayId: string;
        title?: string;
        notes?: string;
        castJson?: string;
        crewJson?: string;
        locationsJson?: string;
        scheduleJson?: string;
      }
    | null;

  if (!body?.shootDayId) {
    return NextResponse.json({ error: "Missing shootDayId" }, { status: 400 });
  }

  const callSheet = await prisma.callSheet.create({
    data: {
      projectId,
      shootDayId: body.shootDayId,
      title: body.title ?? null,
      notes: body.notes ?? null,
      castJson: body.castJson ?? null,
      crewJson: body.crewJson ?? null,
      locationsJson: body.locationsJson ?? null,
      scheduleJson: body.scheduleJson ?? null,
    },
  });

  return NextResponse.json({ callSheet }, { status: 201 });
}
