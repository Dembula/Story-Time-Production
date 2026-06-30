import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { listProjectCollaborators } from "@/lib/script-studio/collaboration-access";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  const gate = await ensureProjectAccess(projectId);
  if (gate.error) return gate.error;

  const collaborators = await listProjectCollaborators(projectId);

  const scripts = await prisma.creatorScript.findMany({
    where: { projectId },
    select: { id: true, title: true, userId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ collaborators, scripts });
}
