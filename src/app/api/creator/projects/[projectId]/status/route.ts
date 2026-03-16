import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { status?: string; phase?: string } | null;
  if (!body?.status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
    include: {
      pitches: {
        take: 1,
        orderBy: { createdAt: "asc" },
      },
      members: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.originalProject.update({
    where: { id: project.id },
    data: {
      status: body.status,
      ...(body.phase ? { phase: body.phase } : {}),
    },
  });

  await prisma.projectActivity.create({
    data: {
      projectId: project.id,
      userId,
      type: "STAGE_CHANGED",
      message: `Status set to ${body.status}${body.phase ? `, phase to ${body.phase}` : ""}`,
      metadata: JSON.stringify({
        previousStatus: project.status,
        previousPhase: project.phase,
        newStatus: body.status,
        newPhase: body.phase ?? project.phase,
      }),
    },
  });

  return NextResponse.json({ project: updated });
}

