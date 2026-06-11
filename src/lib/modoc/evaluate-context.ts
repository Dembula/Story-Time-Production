import { prisma } from "@/lib/prisma";
import type { ModocActionType } from "@/lib/modoc/action-types";
import type { ModocLearningProfile } from "@/lib/modoc/learning";
import { getModocLearning } from "@/lib/modoc/learning";

export type ModocInlineSuggestion = {
  id: string;
  title: string;
  body: string;
  action: ModocActionType;
  payload: Record<string, string | undefined>;
  priority: number;
};

const CREATOR_ROLES = new Set(["CONTENT_CREATOR"]);

export async function evaluateModocContext(params: {
  userId: string;
  role: string;
  projectId?: string | null;
  learning?: ModocLearningProfile;
}): Promise<ModocInlineSuggestion[]> {
  const learning = params.learning ?? (await getModocLearning(params.userId));
  const suggestions: ModocInlineSuggestion[] = [];

  if (!CREATOR_ROLES.has(params.role)) {
    return suggestions;
  }

  const projects = await prisma.originalProject.findMany({
    where: {
      OR: [
        { pitches: { some: { creatorId: params.userId } } },
        { members: { some: { userId: params.userId } } },
      ],
      ...(params.projectId ? { id: params.projectId } : {}),
    },
    select: { id: true, title: true, status: true, phase: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: params.projectId ? 1 : 5,
  });

  for (const project of projects) {
    const [charCount, sceneCount, taskTodo, shootDays, script] = await Promise.all([
      prisma.breakdownCharacter.count({ where: { projectId: project.id } }),
      prisma.projectScene.count({ where: { projectId: project.id } }),
      prisma.projectTask.count({ where: { projectId: project.id, status: "TODO" } }),
      prisma.shootDay.count({ where: { projectId: project.id } }),
      prisma.projectScript.findFirst({
        where: { projectId: project.id },
        include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

    const hasScript =
      Boolean(script?.currentVersionId) ||
      Boolean(script?.versions[0]?.content?.trim());

    if (hasScript && sceneCount === 0) {
      suggestions.push({
        id: `sync-${project.id}`,
        title: "Sync scenes",
        body: `"${project.title}" has a screenplay but no scenes yet. I can sync slug lines now.`,
        action: "sync_scenes_from_script",
        payload: { projectId: project.id },
        priority: 90,
      });
    }

    if (hasScript && charCount === 0 && sceneCount > 0) {
      suggestions.push({
        id: `breakdown-${project.id}`,
        title: "Run full breakdown",
        body: `Ready to extract characters, props, and locations from "${project.title}".`,
        action: "breakdown_full",
        payload: { projectId: project.id },
        priority: 85,
      });
    }

    if (hasScript && sceneCount > 0 && charCount > 0) {
      const budgetCheck = await prisma.projectBudget.findUnique({
        where: { projectId: project.id },
        select: { _count: { select: { lines: true } } },
      });
      if ((budgetCheck?._count.lines ?? 0) === 0) {
        suggestions.push({
          id: `budget-${project.id}`,
          title: "Build your budget",
          body: `"${project.title}" has a breakdown ready. I can generate budget lines from your scenes.`,
          action: "generate_smart_budget",
          payload: { projectId: project.id },
          priority: 82,
        });
      }
    }

    if (
      project.status !== "IN_PRODUCTION" &&
      charCount > 0 &&
      shootDays > 0 &&
      taskTodo === 0
    ) {
      suggestions.push({
        id: `tasks-${project.id}`,
        title: "Starter production tasks",
        body: `I can create kickoff on-set tasks for "${project.title}" (equipment check, call sheet review, safety brief).`,
        action: "create_starter_tasks",
        payload: { projectId: project.id },
        priority: 70,
      });
    }

    if (project.status !== "IN_PRODUCTION" && charCount > 0 && shootDays > 0) {
      const budget = await prisma.projectBudget.findUnique({
        where: { projectId: project.id },
        select: { _count: { select: { lines: true } } },
      });
      if ((budget?._count.lines ?? 0) > 0) {
        suggestions.push({
          id: `production-${project.id}`,
          title: "Move to production",
          body: `"${project.title}" looks ready — breakdown, schedule, and budget are in place.`,
          action: "move_to_production",
          payload: { projectId: project.id },
          priority: 60,
        });
      }
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  if (params.role === "CONTENT_CREATOR") {
    suggestions.push({
      id: `calendar-plan-${params.userId}`,
      title: "Plan your week",
      body: "Want me to block a personal planning session on your Command Center calendar?",
      action: "create_calendar_event",
      payload: {
        title: "Weekly production planning",
        startAt: tomorrow.toISOString(),
        description: "Review projects, tasks, and shoot schedule (created by your VA).",
      },
      priority: 40,
    });

    suggestions.push({
      id: `team-sync-${params.userId}`,
      title: "Team check-in",
      body: "I can add a team calendar event for your studio to align on the week ahead.",
      action: "create_team_calendar_event",
      payload: {
        title: "Team production sync",
        startAt: tomorrow.toISOString(),
        description: "Weekly team alignment (created by your VA).",
      },
      priority: 35,
    });
  }

  const preferred = new Set(learning.preferredSuggestions ?? []);
  return suggestions
    .sort((a, b) => {
      const boostA = preferred.has(a.action) ? 15 : 0;
      const boostB = preferred.has(b.action) ? 15 : 0;
      return b.priority + boostB - (a.priority + boostA);
    })
    .slice(0, 6);
}
