import "server-only";

import { prisma } from "@/lib/prisma";
import type { StudioMemory } from "../types";

const STUDIO_PROJECT_LIMIT = 12;

export async function loadStudioMemory(params: {
  userId: string;
  focusProjectId?: string | null;
}): Promise<StudioMemory> {
  const projects = await prisma.originalProject.findMany({
    where: {
      OR: [
        { pitches: { some: { creatorId: params.userId } } },
        { members: { some: { userId: params.userId } } },
      ],
      ...(params.focusProjectId ? { id: params.focusProjectId } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      phase: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: params.focusProjectId ? 1 : STUDIO_PROJECT_LIMIT,
  });

  if (projects.length === 0) {
    return { projectCount: 0, projects: [] };
  }

  const summaries = await Promise.all(
    projects.map(async (project) => {
      const [sceneCount, characterCount, openTasks, shootDays] = await Promise.all([
        prisma.projectScene.count({ where: { projectId: project.id } }),
        prisma.breakdownCharacter.count({ where: { projectId: project.id } }),
        prisma.projectTask.count({ where: { projectId: project.id, status: "TODO" } }),
        prisma.shootDay.count({ where: { projectId: project.id } }),
      ]);

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        phase: project.phase,
        sceneCount,
        characterCount,
        openTasks,
        shootDays,
        updatedAt: project.updatedAt.toISOString(),
      };
    }),
  );

  return {
    projectCount: summaries.length,
    projects: summaries,
  };
}
