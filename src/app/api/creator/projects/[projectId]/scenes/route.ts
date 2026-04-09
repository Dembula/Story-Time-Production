import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const scenes = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      heading: true,
      summary: true,
      status: true,
      scriptId: true,
    },
  });

  return NextResponse.json({ scenes });
}
