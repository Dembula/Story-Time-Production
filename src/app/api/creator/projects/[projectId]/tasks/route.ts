import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureTaskAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureTaskAccess(projectId);
  if (access.error) return access.error;

  const tasks = await prisma.projectTask.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      shootDay: { select: { id: true, date: true } },
      scene: { select: { id: true, number: true, heading: true } },
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureTaskAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        title: string;
        description?: string;
        department?: string;
        priority?: string;
        shootDayId?: string | null;
        sceneId?: string | null;
      }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  if (body.shootDayId) {
    const day = await prisma.shootDay.findFirst({
      where: { id: body.shootDayId, projectId },
    });
    if (!day) {
      return NextResponse.json({ error: "Invalid shootDayId" }, { status: 400 });
    }
  }
  if (body.sceneId) {
    const sc = await prisma.projectScene.findFirst({
      where: { id: body.sceneId, projectId },
    });
    if (!sc) {
      return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });
    }
  }

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      title: body.title,
      description: body.description ?? null,
      department: body.department ?? null,
      priority: body.priority ?? null,
      shootDayId: body.shootDayId ?? null,
      sceneId: body.sceneId ?? null,
      createdById: userId,
    },
    include: {
      shootDay: { select: { id: true, date: true } },
      scene: { select: { id: true, number: true, heading: true } },
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureTaskAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        title?: string;
        description?: string | null;
        department?: string | null;
        status?: string;
        priority?: string | null;
        shootDayId?: string | null;
        sceneId?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.projectTask.findFirst({
    where: { id: body.id, projectId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (body.shootDayId) {
    const day = await prisma.shootDay.findFirst({
      where: { id: body.shootDayId, projectId },
    });
    if (!day) {
      return NextResponse.json({ error: "Invalid shootDayId" }, { status: 400 });
    }
  }
  if (body.sceneId) {
    const sc = await prisma.projectScene.findFirst({
      where: { id: body.sceneId, projectId },
    });
    if (!sc) {
      return NextResponse.json({ error: "Invalid sceneId" }, { status: 400 });
    }
  }

  const updated = await prisma.projectTask.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.shootDayId !== undefined ? { shootDayId: body.shootDayId } : {}),
      ...(body.sceneId !== undefined ? { sceneId: body.sceneId } : {}),
    },
    include: {
      shootDay: { select: { id: true, date: true } },
      scene: { select: { id: true, number: true, heading: true } },
    },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureTaskAccess(projectId);
  if (access.error) return access.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const result = await prisma.projectTask.deleteMany({
    where: { id, projectId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
