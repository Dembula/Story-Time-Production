import { prisma } from "@/lib/prisma";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

export type CalendarEventKind =
  | "SHOOT_DAY"
  | "PROJECT_TASK"
  | "INCIDENT"
  | "INCIDENT_RESOLVED"
  | "CALL_SHEET"
  | "TABLE_READ"
  | "MANUAL_PERSONAL"
  | "MANUAL_TEAM";

export type CommandCenterCalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  projectId?: string | null;
  projectTitle?: string | null;
  href?: string | null;
  editable: boolean;
  visibility?: "PERSONAL" | "TEAM";
  assigneeId?: string | null;
  assigneeName?: string | null;
  createdById?: string | null;
  status?: string | null;
};

export type CalendarTeamMember = {
  userId: string;
  name: string;
  email: string | null;
  profileDisplayName: string;
};

export type CommandCenterCalendarPayload = {
  events: CommandCenterCalendarEvent[];
  teamMembers: CalendarTeamMember[];
  companyId: string | null;
  companyName: string | null;
  isCompanyAccount: boolean;
  projects: { id: string; title: string }[];
  rangeStart: string;
  rangeEnd: string;
};

function projectWhereForCreator(creatorId: string) {
  return {
    OR: [{ pitches: { some: { creatorId } } }, { members: { some: { userId: creatorId } } }],
  };
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function parseCalendarMonthParam(raw: string | null): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
}

export async function resolveCreatorStudioCompanyContext(userId: string): Promise<{
  companyId: string | null;
  companyName: string | null;
  teamMembers: CalendarTeamMember[];
  isCompanyAccount: boolean;
}> {
  let owned: {
    id: string;
    displayName: string;
    profiles: Array<{
      userId: string;
      displayName: string;
      user: { id: string; name: string | null; email: string | null };
    }>;
  } | null = null;

  try {
    owned = await prisma.studioCompany.findFirst({
      where: { ownerUserId: userId },
      select: {
        id: true,
        displayName: true,
        profiles: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  } catch {
    owned = null;
  }

  if (owned) {
    return {
      companyId: owned.id,
      companyName: owned.displayName,
      isCompanyAccount: true,
      teamMembers: owned.profiles.map((p) => ({
        userId: p.userId,
        name: p.user.name?.trim() || p.displayName,
        email: p.user.email,
        profileDisplayName: p.displayName,
      })),
    };
  }

  try {
    const profile = await prisma.creatorStudioProfile.findFirst({
      where: { userId, companyId: { not: null } },
      select: {
        company: {
          select: {
            id: true,
            displayName: true,
            profiles: {
              select: {
                userId: true,
                displayName: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });
    if (profile?.company) {
      return {
        companyId: profile.company.id,
        companyName: profile.company.displayName,
        isCompanyAccount: true,
        teamMembers: profile.company.profiles.map((p) => ({
          userId: p.userId,
          name: p.user.name?.trim() || p.displayName,
          email: p.user.email,
          profileDisplayName: p.displayName,
        })),
      };
    }
  } catch {
    /* studio tables may be missing */
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creatorAccountStructure: true, name: true, email: true },
  });

  return {
    companyId: null,
    companyName: null,
    isCompanyAccount: user?.creatorAccountStructure === "COMPANY",
    teamMembers: user
      ? [
          {
            userId,
            name: user.name?.trim() || user.email?.split("@")[0] || "You",
            email: user.email,
            profileDisplayName: user.name?.trim() || "You",
          },
        ]
      : [],
  };
}

export async function getCommandCenterCalendar(
  userId: string,
  month: Date,
): Promise<CommandCenterCalendarPayload> {
  const rangeStart = startOfMonth(month);
  const rangeEnd = endOfMonth(month);

  const [projects, companyCtx] = await Promise.all([
    prisma.originalProject.findMany({
      where: projectWhereForCreator(userId),
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    resolveCreatorStudioCompanyContext(userId),
  ]);

  const projectIds = projects.map((p) => p.id);
  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]));

  const events: CommandCenterCalendarEvent[] = [];

  if (projectIds.length > 0) {
    const [shootDays, tasks, incidents, callSheets, tableReads] = await Promise.all([
      prisma.shootDay.findMany({
        where: { projectId: { in: projectIds }, date: { gte: rangeStart, lte: rangeEnd } },
        select: {
          id: true,
          projectId: true,
          date: true,
          status: true,
          unit: true,
          callTime: true,
          locationSummary: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.projectTask.findMany({
        where: {
          projectId: { in: projectIds },
          dueDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
      }),
      prisma.incidentReport.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { createdAt: { gte: rangeStart, lte: rangeEnd } },
            { resolvedAt: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          severity: true,
          resolved: true,
          createdAt: true,
          resolvedAt: true,
          resolutionOwner: { select: { id: true, name: true } },
        },
      }),
      prisma.callSheet.findMany({
        where: {
          projectId: { in: projectIds },
          shootDay: { date: { gte: rangeStart, lte: rangeEnd } },
        },
        select: {
          id: true,
          projectId: true,
          title: true,
          shootDay: { select: { id: true, date: true } },
        },
      }),
      prisma.tableReadSession.findMany({
        where: {
          projectId: { in: projectIds },
          scheduledAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: {
          id: true,
          projectId: true,
          name: true,
          scheduledAt: true,
        },
      }),
    ]);

    for (const sd of shootDays) {
      events.push({
        id: `shoot-${sd.id}`,
        kind: "SHOOT_DAY",
        title: sd.unit ? `Shoot day (${sd.unit})` : "Shoot day",
        description: [sd.callTime && `Call ${sd.callTime}`, sd.locationSummary].filter(Boolean).join(" · ") || null,
        startAt: sd.date.toISOString(),
        allDay: true,
        projectId: sd.projectId,
        projectTitle: projectTitleById.get(sd.projectId) ?? null,
        href: `/creator/projects/${sd.projectId}/production/control-center`,
        editable: false,
        status: sd.status,
      });
    }

    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        id: `task-${t.id}`,
        kind: "PROJECT_TASK",
        title: t.title,
        startAt: t.dueDate.toISOString(),
        allDay: true,
        projectId: t.projectId,
        projectTitle: projectTitleById.get(t.projectId) ?? null,
        href: `/creator/projects/${t.projectId}/production/on-set-tasks`,
        editable: false,
        status: t.status,
        assigneeId: t.assignee?.id ?? null,
        assigneeName: t.assignee?.name ?? null,
      });
    }

    for (const i of incidents) {
      events.push({
        id: `incident-${i.id}`,
        kind: "INCIDENT",
        title: i.resolved ? `Incident (resolved): ${i.title}` : `Incident: ${i.title}`,
        startAt: i.createdAt.toISOString(),
        allDay: true,
        projectId: i.projectId,
        projectTitle: projectTitleById.get(i.projectId) ?? null,
        href: `/creator/projects/${i.projectId}/production/incident-reporting`,
        editable: false,
        status: i.resolved ? "RESOLVED" : "OPEN",
        assigneeId: i.resolutionOwner?.id ?? null,
        assigneeName: i.resolutionOwner?.name ?? null,
      });
      if (i.resolvedAt && i.resolvedAt >= rangeStart && i.resolvedAt <= rangeEnd) {
        events.push({
          id: `incident-resolved-${i.id}`,
          kind: "INCIDENT_RESOLVED",
          title: `Resolved: ${i.title}`,
          startAt: i.resolvedAt.toISOString(),
          allDay: true,
          projectId: i.projectId,
          projectTitle: projectTitleById.get(i.projectId) ?? null,
          href: `/creator/projects/${i.projectId}/production/incident-reporting`,
          editable: false,
          status: "RESOLVED",
        });
      }
    }

    for (const cs of callSheets) {
      events.push({
        id: `callsheet-${cs.id}`,
        kind: "CALL_SHEET",
        title: cs.title?.trim() || "Call sheet",
        startAt: cs.shootDay.date.toISOString(),
        allDay: true,
        projectId: cs.projectId,
        projectTitle: projectTitleById.get(cs.projectId) ?? null,
        href: `/creator/projects/${cs.projectId}/production/call-sheet-generator`,
        editable: false,
      });
    }

    for (const tr of tableReads) {
      if (!tr.scheduledAt) continue;
      events.push({
        id: `tableread-${tr.id}`,
        kind: "TABLE_READ",
        title: tr.name?.trim() || "Table read",
        startAt: tr.scheduledAt.toISOString(),
        allDay: false,
        projectId: tr.projectId,
        projectTitle: projectTitleById.get(tr.projectId) ?? null,
        href: `/creator/projects/${tr.projectId}/pre-production/table-reads`,
        editable: false,
      });
    }
  }

  try {
    const manualWhere =
      companyCtx.companyId != null
        ? {
            OR: [
              { ownerUserId: userId },
              { assigneeId: userId, visibility: "PERSONAL" },
              { companyId: companyCtx.companyId, visibility: "TEAM" },
            ],
            startAt: { gte: rangeStart, lte: rangeEnd },
          }
        : {
            OR: [{ ownerUserId: userId }, { assigneeId: userId }],
            startAt: { gte: rangeStart, lte: rangeEnd },
          };

    const manual = await prisma.creatorCalendarEvent.findMany({
      where: manualWhere,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { startAt: "asc" },
    });

    for (const m of manual) {
      events.push({
        id: m.id,
        kind: m.visibility === "TEAM" ? "MANUAL_TEAM" : "MANUAL_PERSONAL",
        title: m.title,
        description: m.description,
        startAt: m.startAt.toISOString(),
        endAt: m.endAt?.toISOString() ?? null,
        allDay: m.allDay,
        projectId: m.projectId,
        projectTitle: m.project?.title ?? (m.projectId ? projectTitleById.get(m.projectId) : null),
        href: m.projectId
          ? `/creator/projects/${m.projectId}/production/control-center`
          : "/creator/command-center",
        editable: m.createdById === userId || m.ownerUserId === userId,
        visibility: m.visibility as "PERSONAL" | "TEAM",
        assigneeId: m.assigneeId,
        assigneeName: m.assignee?.name ?? null,
        createdById: m.createdById,
      });
    }
  } catch (e) {
    if (!isPrismaMissingTable(e, "CreatorCalendarEvent")) throw e;
  }

  events.sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    events,
    teamMembers: companyCtx.teamMembers,
    companyId: companyCtx.companyId,
    companyName: companyCtx.companyName,
    isCompanyAccount: companyCtx.isCompanyAccount,
    projects,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  };
}

export type CreateCalendarEventInput = {
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  visibility: "PERSONAL" | "TEAM";
  projectId?: string | null;
  assigneeId?: string | null;
};

export async function createCreatorCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput,
): Promise<{ id: string }> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const startAt = new Date(input.startAt);
  if (Number.isNaN(startAt.getTime())) throw new Error("Invalid start date");

  const companyCtx = await resolveCreatorStudioCompanyContext(userId);
  if (input.visibility === "TEAM" && !companyCtx.companyId) {
    throw new Error("Team tasks require a company studio account");
  }

  if (input.assigneeId) {
    const allowed = new Set(companyCtx.teamMembers.map((m) => m.userId));
    if (!allowed.has(input.assigneeId)) {
      throw new Error("Assignee must be a team member");
    }
  }

  if (input.projectId) {
    const project = await prisma.originalProject.findFirst({
      where: { id: input.projectId, ...projectWhereForCreator(userId) },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found");
  }

  const endAt = input.endAt ? new Date(input.endAt) : null;
  if (endAt && Number.isNaN(endAt.getTime())) throw new Error("Invalid end date");

  const row = await prisma.creatorCalendarEvent.create({
    data: {
      ownerUserId: userId,
      createdById: userId,
      companyId: input.visibility === "TEAM" ? companyCtx.companyId : null,
      projectId: input.projectId || null,
      title,
      description: input.description?.trim() || null,
      startAt,
      endAt,
      allDay: input.allDay ?? true,
      visibility: input.visibility,
      assigneeId: input.assigneeId || null,
    },
    select: { id: true },
  });

  return row;
}

export async function updateCreatorCalendarEvent(
  userId: string,
  eventId: string,
  input: Partial<CreateCalendarEventInput>,
): Promise<void> {
  const existing = await prisma.creatorCalendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, createdById: true, ownerUserId: true },
  });
  if (!existing) throw new Error("Event not found");
  if (existing.createdById !== userId && existing.ownerUserId !== userId) {
    throw new Error("Not allowed to edit this event");
  }

  const companyCtx = await resolveCreatorStudioCompanyContext(userId);
  const visibility = input.visibility;
  if (visibility === "TEAM" && !companyCtx.companyId) {
    throw new Error("Team tasks require a company studio account");
  }

  if (input.assigneeId) {
    const allowed = new Set(companyCtx.teamMembers.map((m) => m.userId));
    if (!allowed.has(input.assigneeId)) throw new Error("Assignee must be a team member");
  }

  if (input.projectId) {
    const project = await prisma.originalProject.findFirst({
      where: { id: input.projectId, ...projectWhereForCreator(userId) },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found");
  }

  await prisma.creatorCalendarEvent.update({
    where: { id: eventId },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.startAt != null ? { startAt: new Date(input.startAt) } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt ? new Date(input.endAt) : null } : {}),
      ...(input.allDay != null ? { allDay: input.allDay } : {}),
      ...(visibility != null
        ? {
            visibility,
            companyId: visibility === "TEAM" ? companyCtx.companyId : null,
          }
        : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId || null } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
    },
  });
}

export async function deleteCreatorCalendarEvent(userId: string, eventId: string): Promise<void> {
  const existing = await prisma.creatorCalendarEvent.findUnique({
    where: { id: eventId },
    select: { createdById: true, ownerUserId: true },
  });
  if (!existing) throw new Error("Event not found");
  if (existing.createdById !== userId && existing.ownerUserId !== userId) {
    throw new Error("Not allowed to delete this event");
  }
  await prisma.creatorCalendarEvent.delete({ where: { id: eventId } });
}
