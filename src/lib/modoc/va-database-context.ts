import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CALENDAR_LOOKBACK_DAYS,
  MAX_CALENDAR_IN_DB_CONTEXT,
  MAX_PROJECTS_IN_DB_CONTEXT,
  MAX_SHOOT_DAYS_IN_DB_CONTEXT,
  MAX_TASKS_IN_DB_CONTEXT,
  MAX_VA_MESSAGES_IN_DB_CONTEXT,
} from "./learning-limits";

/** Read-only creator workspace snapshot from the database for VA chat context. */
export async function buildCreatorDatabaseContext(
  userId: string,
  focusProjectId?: string | null,
): Promise<string> {
  const projectWhere = {
    OR: [
      { pitches: { some: { creatorId: userId } } },
      { members: { some: { userId } } },
    ],
    ...(focusProjectId ? { id: focusProjectId } : {}),
  };

  const [projects, calendarEvents, openTasks, recentMessages] = await Promise.all([
    prisma.originalProject.findMany({
      where: projectWhere,
      select: {
        id: true,
        title: true,
        status: true,
        phase: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: focusProjectId ? 1 : MAX_PROJECTS_IN_DB_CONTEXT,
    }),
    prisma.creatorCalendarEvent.findMany({
      where: {
        ownerUserId: userId,
        startAt: { gte: new Date(Date.now() - CALENDAR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      },
      orderBy: { startAt: "asc" },
      take: MAX_CALENDAR_IN_DB_CONTEXT,
      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,
        visibility: true,
        projectId: true,
      },
    }),
    prisma.projectTask.findMany({
      where: {
        status: "TODO",
        project: projectWhere,
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_TASKS_IN_DB_CONTEXT,
      select: {
        id: true,
        title: true,
        priority: true,
        department: true,
        projectId: true,
        project: { select: { title: true } },
      },
    }),
    prisma.modocMessage.findMany({
      where: {
        conversation: { userId },
        role: "user",
      },
      orderBy: { createdAt: "desc" },
      take: MAX_VA_MESSAGES_IN_DB_CONTEXT,
      select: { content: true, createdAt: true },
    }),
  ]);

  if (projects.length === 0) {
    return "**Database (creator scope):** No projects found for this creator.";
  }

  const projectIds = projects.map((p) => p.id);

  const [scripts, sceneCounts, charCounts, shootDays, budgets] = await Promise.all([
    prisma.projectScript.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        projectId: true,
        currentVersionId: true,
        versions: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      },
    }),
    prisma.projectScene.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _count: { id: true },
    }),
    prisma.breakdownCharacter.groupBy({
      by: ["projectId"],
      where: { projectId: { in: projectIds } },
      _count: { id: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { date: "asc" },
      take: MAX_SHOOT_DAYS_IN_DB_CONTEXT,
      select: { id: true, projectId: true, date: true, unit: true, status: true, locationSummary: true },
    }),
    prisma.projectBudget.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        projectId: true,
        _count: { select: { lines: true } },
        totalPlanned: true,
      },
    }),
  ]);

  const scriptByProject = new Map(scripts.map((s) => [s.projectId, s]));
  const scenesByProject = new Map(sceneCounts.map((s) => [s.projectId, s._count.id]));
  const charsByProject = new Map(charCounts.map((c) => [c.projectId, c._count.id]));
  const budgetByProject = new Map(budgets.map((b) => [b.projectId, b]));

  const lines: string[] = [
    "**Database access (read-only, creator-scoped)** — use these real records when answering; never invent IDs.",
    "",
    "**Projects:**",
  ];

  for (const project of projects) {
    const script = scriptByProject.get(project.id);
    const hasScript =
      Boolean(script?.currentVersionId) ||
      Boolean(script?.versions[0]?.content?.trim());
    const sceneCount = scenesByProject.get(project.id) ?? 0;
    const charCount = charsByProject.get(project.id) ?? 0;
    const budget = budgetByProject.get(project.id);
    lines.push(
      `- id=${project.id} | "${project.title}" | status=${project.status} | phase=${project.phase} | script=${hasScript ? "yes" : "no"} | scenes=${sceneCount} | characters=${charCount} | budgetLines=${budget?._count.lines ?? 0} | updated=${project.updatedAt.toISOString()}`,
    );
  }

  if (openTasks.length > 0) {
    lines.push("", "**Open tasks (TODO):**");
    for (const task of openTasks) {
      lines.push(
        `- id=${task.id} | project="${task.project.title}" (${task.projectId}) | "${task.title}" | ${task.priority ?? "MEDIUM"}${task.department ? ` | ${task.department}` : ""}`,
      );
    }
  }

  if (shootDays.length > 0) {
    lines.push("", "**Upcoming / recent shoot days:**");
    for (const day of shootDays) {
      lines.push(
        `- id=${day.id} | projectId=${day.projectId} | ${day.date.toISOString()} | ${day.locationSummary ?? day.unit ?? "Shoot day"} | ${day.status}`,
      );
    }
  }

  if (calendarEvents.length > 0) {
    lines.push("", "**Calendar events (database):**");
    for (const event of calendarEvents) {
      lines.push(
        `- id=${event.id} | "${event.title}" | ${event.startAt.toISOString()} | ${event.visibility}${event.projectId ? ` | projectId=${event.projectId}` : ""}`,
      );
    }
  } else {
    lines.push("", "**Calendar events (database):** none in the recent window.");
  }

  if (recentMessages.length > 0) {
    lines.push("", "**Recent creator questions to VA (database):**");
    for (const msg of recentMessages) {
      lines.push(`- ${msg.createdAt.toISOString()}: ${msg.content.slice(0, 160)}`);
    }
  }

  return lines.join("\n");
}
