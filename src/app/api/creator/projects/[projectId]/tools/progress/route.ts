import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureCreatorAccess(projectId: string) {
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureCreatorAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        phase: "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION";
        toolId: string;
        status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
        percent?: number;
        pipelineStep?: string;
      }
    | null;

  if (!body?.toolId || !body.phase) {
    return NextResponse.json(
      { error: "Missing phase or toolId" },
      { status: 400 },
    );
  }

  const percent = Math.min(
    100,
    Math.max(0, body.percent ?? (body.status === "COMPLETE" ? 100 : 0)),
  );

  const progress = await prisma.projectToolProgress.upsert({
    where: {
      projectId_toolId: {
        projectId,
        toolId: body.toolId,
      },
    },
    update: {
      phase: body.phase,
      status: body.status ?? "IN_PROGRESS",
      percent,
      pipelineStep: body.pipelineStep ?? undefined,
    },
    create: {
      projectId,
      phase: body.phase,
      toolId: body.toolId,
      status: body.status ?? "IN_PROGRESS",
      percent,
      pipelineStep: body.pipelineStep ?? undefined,
    },
  });

  return NextResponse.json({ progress });
}

