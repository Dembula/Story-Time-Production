import { prisma } from "@/lib/prisma";

export async function buildCreatorWorkspaceContext(
  userId: string,
  projectId?: string | null,
): Promise<string> {
  const projects = await prisma.originalProject.findMany({
    where: {
      OR: [
        { pitches: { some: { creatorId: userId } } },
        { members: { some: { userId } } },
      ],
      ...(projectId ? { id: projectId } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      phase: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: projectId ? 1 : 12,
  });

  if (projects.length === 0) {
    return "This creator has no projects yet. Help them get started in their creator workspace only.";
  }

  const lines = await Promise.all(
    projects.map(async (project) => {
      const [sceneCount, charCount, taskTodo, shootDays] = await Promise.all([
        prisma.projectScene.count({ where: { projectId: project.id } }),
        prisma.breakdownCharacter.count({ where: { projectId: project.id } }),
        prisma.projectTask.count({ where: { projectId: project.id, status: "TODO" } }),
        prisma.shootDay.count({ where: { projectId: project.id } }),
      ]);
      return `- id=${project.id} | title="${project.title}" | status=${project.status} | phase=${project.phase} | scenes=${sceneCount} | characters=${charCount} | openTasks=${taskTodo} | shootDays=${shootDays}`;
    }),
  );

  return `**Creator workspace (only these projects — do not access other users' data):**
${lines.join("\n")}`;
}
