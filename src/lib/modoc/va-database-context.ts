import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CALENDAR_LOOKBACK_DAYS,
  MAX_CALENDAR_IN_DB_CONTEXT,
  MAX_CHARACTERS_IN_SCRIPT_CONTEXT,
  MAX_PROJECTS_IN_DB_CONTEXT,
  MAX_SCENES_IN_SCRIPT_CONTEXT,
  MAX_SCRIPT_CHARS_IN_CONTEXT,
  MAX_SCRIPT_PREVIEW_CHARS,
  MAX_SHOOT_DAYS_IN_DB_CONTEXT,
  MAX_TASKS_IN_DB_CONTEXT,
  MAX_VA_MESSAGES_IN_DB_CONTEXT,
} from "./learning-limits";
import { resolveScriptText } from "./va-script-text";
import { buildMarketplaceContextForProject } from "./va-marketplace-context";

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
  const primaryProjectId = focusProjectId ?? projectIds[0];

  const [scripts, sceneCounts, charCounts, shootDays, budgets, focusScenes, focusCharacters, ideaNotes, focusBudgetLines, productionContext, budgetAssumptions] =
    await Promise.all([
      prisma.projectScript.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          title: true,
          currentVersionId: true,
          versions: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { id: true, content: true, versionLabel: true, createdAt: true },
          },
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
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          projectId: true,
          _count: { select: { lines: true } },
          totalPlanned: true,
        },
      }),
      primaryProjectId
        ? prisma.projectScene.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { number: "asc" },
            take: MAX_SCENES_IN_SCRIPT_CONTEXT,
            select: {
              number: true,
              heading: true,
              summary: true,
              intExt: true,
              timeOfDay: true,
              status: true,
              pageCount: true,
            },
          })
        : Promise.resolve([]),
      primaryProjectId
        ? prisma.breakdownCharacter.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { name: "asc" },
            take: MAX_CHARACTERS_IN_SCRIPT_CONTEXT,
            select: { name: true, description: true, importance: true },
          })
        : Promise.resolve([]),
      primaryProjectId
        ? prisma.projectIdea.findFirst({
            where: { projectId: primaryProjectId },
            select: { title: true, logline: true, genres: true, notes: true },
          })
        : Promise.resolve(null),
      primaryProjectId
        ? prisma.projectBudgetLine.findMany({
            where: { budget: { projectId: primaryProjectId } },
            orderBy: { total: "desc" },
            take: 25,
            select: { department: true, name: true, quantity: true, unitCost: true, total: true },
          })
        : Promise.resolve([]),
      primaryProjectId
        ? prisma.projectProductionContext.findUnique({ where: { projectId: primaryProjectId } })
        : Promise.resolve(null),
      primaryProjectId
        ? prisma.projectBudgetAssumption.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: { category: true, label: true, detail: true, amount: true, sourceType: true },
          })
        : Promise.resolve([]),
    ]);

  const focusOps =
    primaryProjectId
      ? await Promise.all([
          prisma.projectContract.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: { id: true, type: true, status: true, subject: true, vendorName: true },
          }),
          prisma.castingInvitation.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              role: { select: { name: true } },
              talent: { select: { name: true } },
            },
          }),
          prisma.crewInvitation.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              need: { select: { role: true } },
              crewTeam: { select: { companyName: true } },
            },
          }),
          prisma.dailiesBatch.findMany({
            where: { projectId: primaryProjectId },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              title: true,
              shootDayId: true,
              sceneId: true,
              _count: { select: { reviewNotes: true } },
            },
          }),
          Promise.all([
            prisma.castingRole.count({ where: { projectId: primaryProjectId } }),
            prisma.crewRoleNeed.count({ where: { projectId: primaryProjectId } }),
            prisma.breakdownLocation.count({ where: { projectId: primaryProjectId } }),
            prisma.equipmentPlanItem.count({ where: { projectId: primaryProjectId } }),
            prisma.projectContract.count({
              where: {
                projectId: primaryProjectId,
                NOT: { status: { in: ["SIGNED", "EXECUTED", "CLOSED"] } },
              },
            }),
            prisma.riskChecklistItem.count({
              where: { plan: { projectId: primaryProjectId }, status: { not: "DONE" } },
            }),
          ]),
        ])
      : [[], [], [], [], [0, 0, 0, 0, 0, 0]];

  const [focusContracts, focusCastingInvites, focusCrewInvites, focusDailies, readinessCounts] =
    focusOps as [
      Array<{ id: string; type: string; status: string; subject: string | null; vendorName: string | null }>,
      Array<{ id: string; status: string; role: { name: string }; talent: { name: string } | null }>,
      Array<{ id: string; status: string; need: { role: string }; crewTeam: { companyName: string } | null }>,
      Array<{ id: string; title: string | null; shootDayId: string | null; sceneId: string | null; _count: { reviewNotes: number } }>,
      [number, number, number, number, number, number],
    ];

  const scriptByProject = new Map(scripts.map((s) => [s.projectId, s]));
  const scenesByProject = new Map(sceneCounts.map((s) => [s.projectId, s._count.id]));
  const charsByProject = new Map(charCounts.map((c) => [c.projectId, c._count.id]));
  const budgetByProject = new Map<string, (typeof budgets)[number]>();
  for (const b of budgets) {
    if (!budgetByProject.has(b.projectId)) budgetByProject.set(b.projectId, b);
  }

  const lines: string[] = [
    "**Database access (read-only, creator-scoped)** — use these real records when answering about scripts, breakdowns, schedules, and production data. Never invent IDs.",
    "",
    "**Projects:**",
  ];

  for (const project of projects) {
    const script = scriptByProject.get(project.id);
    const scriptText = script ? resolveScriptText(script) : "";
    const hasScript = scriptText.length > 0;
    const sceneCount = scenesByProject.get(project.id) ?? 0;
    const charCount = charsByProject.get(project.id) ?? 0;
    const budget = budgetByProject.get(project.id);
    lines.push(
      `- id=${project.id} | "${project.title}" | status=${project.status} | phase=${project.phase} | script=${hasScript ? "yes" : "no"} | scenes=${sceneCount} | characters=${charCount} | budgetLines=${budget?._count.lines ?? 0} | updated=${project.updatedAt.toISOString()}`,
    );

    if (hasScript && project.id !== primaryProjectId) {
      lines.push(
        `  Script preview ("${script?.title ?? "Screenplay"}"): ${scriptText.slice(0, MAX_SCRIPT_PREVIEW_CHARS)}${scriptText.length > MAX_SCRIPT_PREVIEW_CHARS ? "…" : ""}`,
      );
    }
  }

  const focusProject = projects.find((p) => p.id === primaryProjectId);
  const focusScript = scriptByProject.get(primaryProjectId);
  const focusScriptText = focusScript ? resolveScriptText(focusScript) : "";

  if (focusProject && focusScriptText) {
    lines.push(
      "",
      `**Full screenplay — "${focusProject.title}" (projectId=${primaryProjectId})**`,
      `Use this text for script review, scene questions, dialogue, structure, and breakdown advice:`,
      focusScriptText.length > MAX_SCRIPT_CHARS_IN_CONTEXT
        ? focusScriptText.slice(0, MAX_SCRIPT_CHARS_IN_CONTEXT) + "\n… [script truncated for token budget — reference scene list below for full coverage]"
        : focusScriptText,
    );
  } else if (focusProject) {
    lines.push("", `**Screenplay for "${focusProject.title}":** not uploaded yet in Script Writing.`);
  }

  if (ideaNotes && (ideaNotes.logline || ideaNotes.notes || ideaNotes.genres)) {
    lines.push(
      "",
      `**Idea development — "${focusProject?.title ?? "project"}":**`,
      ideaNotes.logline ? `Logline: ${ideaNotes.logline}` : "",
      ideaNotes.genres ? `Genres: ${ideaNotes.genres}` : "",
      ideaNotes.notes ? `Notes: ${ideaNotes.notes.slice(0, 800)}` : "",
    );
  }

  if (focusScenes.length > 0) {
    lines.push("", `**Scene breakdown — "${focusProject?.title ?? "project"}":**`);
    for (const scene of focusScenes) {
      lines.push(
        `- Scene ${scene.number} | ${scene.heading ?? "—"} | ${scene.intExt ?? ""} ${scene.timeOfDay ?? ""} | ${scene.status}${scene.pageCount != null ? ` | ${scene.pageCount}pp` : ""}${scene.summary ? ` | ${scene.summary.slice(0, 120)}` : ""}`,
      );
    }
  }

  if (focusCharacters.length > 0) {
    lines.push("", `**Characters — "${focusProject?.title ?? "project"}":**`);
    for (const char of focusCharacters) {
      lines.push(
        `- ${char.name}${char.importance ? ` (${char.importance})` : ""}${char.description ? `: ${char.description.slice(0, 100)}` : ""}`,
      );
    }
  }

  if (focusBudgetLines.length > 0) {
    lines.push("", `**Budget lines — "${focusProject?.title ?? "project"}":**`);
    for (const line of focusBudgetLines) {
      lines.push(
        `- ${line.department} | ${line.name} | qty=${line.quantity ?? 1} | R${(line.total ?? 0).toLocaleString("en-ZA")}`,
      );
    }
    const focusBudget = budgetByProject.get(primaryProjectId);
    if (focusBudget?.totalPlanned) {
      lines.push(`Total planned: R${focusBudget.totalPlanned.toLocaleString("en-ZA")}`);
    }
  }

  if (productionContext) {
    lines.push(
      "",
      `**Production context (inferred) — "${focusProject?.title ?? "project"}":**`,
      `Region: ${productionContext.regionLabel ?? "—"} | City: ${productionContext.primaryCity ?? "—"} | ~${productionContext.estimatedShootDays} shoot day(s) | INT ${productionContext.intSceneCount} / EXT ${productionContext.extSceneCount}`,
    );
  }

  if (budgetAssumptions.length > 0) {
    lines.push("", `**Recent budget assumptions (VA/marketplace):**`);
    for (const row of budgetAssumptions) {
      lines.push(
        `- ${row.category} | ${row.label}${row.amount != null ? ` | R${row.amount.toLocaleString("en-ZA")}` : ""} | ${row.sourceType} — ${row.detail.slice(0, 120)}`,
      );
    }
  }

  if (primaryProjectId && readinessCounts.some((n) => n > 0)) {
    const [castRoles, crewNeeds, locations, equipItems, unsignedContracts, openRisks] = readinessCounts;
    lines.push(
      "",
      `**Production readiness — "${focusProject?.title ?? "project"}":**`,
      `Cast roles: ${castRoles} | Crew needs: ${crewNeeds} | Locations: ${locations} | Equipment items: ${equipItems} | Unsigned contracts: ${unsignedContracts} | Open risk items: ${openRisks}`,
    );
  }

  if (focusContracts.length > 0) {
    lines.push("", `**Contracts — "${focusProject?.title ?? "project"}":**`);
    for (const c of focusContracts) {
      lines.push(
        `- id=${c.id} | ${c.type} | ${c.status} | ${c.subject ?? c.vendorName ?? "—"}`,
      );
    }
  }

  if (focusCastingInvites.length > 0) {
    lines.push("", `**Casting invitations:**`);
    for (const inv of focusCastingInvites) {
      lines.push(
        `- id=${inv.id} | ${inv.role.name} | ${inv.status}${inv.talent?.name ? ` → ${inv.talent.name}` : ""}`,
      );
    }
  }

  if (focusCrewInvites.length > 0) {
    lines.push("", `**Crew invitations:**`);
    for (const inv of focusCrewInvites) {
      lines.push(
        `- id=${inv.id} | ${inv.need.role} | ${inv.status}${inv.crewTeam?.companyName ? ` → ${inv.crewTeam.companyName}` : ""}`,
      );
    }
  }

  if (focusDailies.length > 0) {
    lines.push("", `**Dailies batches:**`);
    for (const batch of focusDailies) {
      lines.push(
        `- id=${batch.id} | ${batch.title ?? "Dailies"} | notes=${batch._count.reviewNotes}${batch.shootDayId ? ` | shootDayId=${batch.shootDayId}` : ""}`,
      );
    }
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

  if (primaryProjectId && focusScriptText) {
    const marketplaceBlock = await buildMarketplaceContextForProject({
      scriptText: focusScriptText,
      sceneHeadings: focusScenes.map((s) => s.heading ?? ""),
    });
    lines.push("", marketplaceBlock);
  }

  return lines.join("\n");
}
