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
      }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const task = await prisma.projectTask.create({
    data: {
      projectId,
      title: body.title,
      description: body.description ?? null,
      department: body.department ?? null,
      priority: body.priority ?? null,
      createdById: userId,
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
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updated = await prisma.projectTask.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
    },
  });

  return NextResponse.json({ task: updated });
}

