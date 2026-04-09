import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await context.params;

  const [project, toolProgress, linkedContent] = await Promise.all([
    prisma.originalProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, status: true, phase: true },
    }),
    prisma.projectToolProgress.findMany({
      where: { projectId },
      select: { toolId: true, phase: true, status: true, percent: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.content.findMany({
      where: { linkedProjectId: projectId },
      select: {
        id: true,
        title: true,
        reviewStatus: true,
        submittedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ project, toolProgress, linkedContent });
}
