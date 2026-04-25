import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { buildProductionDataEngine } from "@/lib/production-day-engine";

interface Params {
  params: Promise<{ projectId: string }>;
}

type LinkedItemType =
  | "SCENE"
  | "PRODUCTION_DAY"
  | "CAST"
  | "CREW"
  | "LOCATION"
  | "EQUIPMENT"
  | "CONTRACT"
  | "FUNDING"
  | "OTHER";

type TaskMeta = {
  linkedItemType?: LinkedItemType;
  linkedItemId?: string | null;
  linkedItemLabel?: string | null;
  comments?: Array<{
    id: string;
    userId: string | null;
    userName: string | null;
    body: string;
    createdAt: string;
    mentions?: string[];
  }>;
  requireSignedContracts?: boolean;
  autoTaskKey?: string;
  blockedReason?: string | null;
  blockedAt?: string | null;
  blockedByUserId?: string | null;
};

const TASK_META_START = "[ST_TASK_META]";
const TASK_META_END = "[/ST_TASK_META]";

function parseTaskMeta(description: string | null | undefined): { plain: string | null; meta: TaskMeta } {
  const txt = (description ?? "").trim();
  if (!txt) return { plain: null, meta: {} };
  const start = txt.indexOf(TASK_META_START);
  const end = txt.indexOf(TASK_META_END);
  if (start === -1 || end === -1 || end <= start) return { plain: txt, meta: {} };
  const payload = txt.slice(start + TASK_META_START.length, end).trim();
  const before = txt.slice(0, start).trim();
  const after = txt.slice(end + TASK_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim() || null;
  try {
    const parsed = JSON.parse(payload) as TaskMeta;
    return { plain, meta: parsed ?? {} };
  } catch {
    return { plain, meta: {} };
  }
}

function composeTaskDescription(plain: string | null | undefined, meta: TaskMeta): string | null {
  const p = (plain ?? "").trim();
  const hasMeta = Object.keys(meta).length > 0;
  if (!p && !hasMeta) return null;
  const blocks: string[] = [];
  if (p) blocks.push(p);
  if (hasMeta) blocks.push(`${TASK_META_START}\n${JSON.stringify(meta)}\n${TASK_META_END}`);
  return blocks.join("\n\n");
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function buildWorkspaceSnapshot(projectId: string) {
  const [project, funding, budget, expenses, tasks, schedule, engine, contracts, activities, castRoles, crewNeeds, locations, equipmentItems] =
    await Promise.all([
      prisma.originalProject.findUnique({
        where: { id: projectId },
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
          pitches: {
            orderBy: { createdAt: "desc" },
            include: { creator: { select: { id: true, name: true, email: true, role: true } } },
          },
        },
      }),
      prisma.fundingRequest.findUnique({ where: { projectId } }),
      prisma.projectBudget.findUnique({ where: { projectId }, include: { lines: true } }),
      prisma.productionExpense.findMany({ where: { projectId }, orderBy: { spentAt: "desc" }, take: 200 }),
      prisma.projectTask.findMany({
        where: { projectId },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          assignee: { select: { id: true, name: true, email: true, role: true } },
          shootDay: { select: { id: true, date: true, status: true } },
          scene: { select: { id: true, number: true, heading: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.shootDay.findMany({
        where: { projectId },
        orderBy: { date: "asc" },
        include: { scenes: true },
      }),
      buildProductionDataEngine(prisma, projectId, null),
      prisma.projectContract.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectActivity.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true } } },
        take: 120,
      }),
      prisma.castingRole.findMany({ where: { projectId }, include: { invitations: { where: { status: "ACCEPTED" }, take: 1 } } }),
      prisma.crewRoleNeed.findMany({ where: { projectId } }),
      prisma.breakdownLocation.findMany({
        where: { projectId },
        include: {
          locationListing: {
            include: { bookings: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      }),
      prisma.equipmentPlanItem.findMany({ where: { projectId }, include: { equipmentListing: true } }),
    ]);

  if (!project) return null;

  const signedContracts = contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED"].includes(c.status)).length;
  const pendingContracts = contracts.length - signedContracts;
  const estimatedBudget = budget?.totalPlanned ?? budget?.lines.reduce((s, l) => s + toNum(l.total), 0) ?? toNum(project.budget);
  const actualSpend = expenses.reduce((s, e) => s + toNum(e.amount), 0);
  const fundingSecured = toNum(funding?.amount);
  const overdueTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED" && t.dueDate && t.dueDate.getTime() < Date.now());
  const scheduleDelayed = schedule.some((d) => d.status === "CANCELLED") || (engine?.conflicts.length ?? 0) > 0;
  const openTaskCount = tasks.filter((t) => t.status !== "DONE" && t.status !== "COMPLETED").length;
  const doneTaskCount = tasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
  const taskProgressPercent = tasks.length ? Math.round((doneTaskCount / tasks.length) * 100) : 0;

  const deptStats = Object.entries(
    tasks.reduce(
      (acc, task) => {
        const key = (task.department || "Production").trim() || "Production";
        if (!acc[key]) acc[key] = { total: 0, done: 0, inProgress: 0, todo: 0, blocked: 0 };
        acc[key].total += 1;
        if (task.status === "DONE" || task.status === "COMPLETED") acc[key].done += 1;
        else if (task.status === "BLOCKED") acc[key].blocked += 1;
        else if (task.status === "IN_PROGRESS") acc[key].inProgress += 1;
        else acc[key].todo += 1;
        return acc;
      },
      {} as Record<string, { total: number; done: number; inProgress: number; todo: number; blocked: number }>,
    ),
  ).map(([department, stats]) => ({
    department,
    ...stats,
    completionPercent: stats.total ? Math.round((stats.done / stats.total) * 100) : 0,
  }));

  const enrichedTasks = tasks.map((task) => {
    const { plain, meta } = parseTaskMeta(task.description);
    return {
      ...task,
      description: plain,
      meta,
      linkedItem: {
        type: meta.linkedItemType ?? null,
        id: meta.linkedItemId ?? null,
        label: meta.linkedItemLabel ?? null,
      },
    };
  });
  const blockedTasks = enrichedTasks.filter((task) => task.status === "BLOCKED");

  const teamMap = new Map<
    string,
    { id: string; name: string | null; email: string | null; role: string; viewRole: string }
  >();
  for (const member of project.members) {
    teamMap.set(member.user.id, {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.user.role,
      viewRole: "CREW",
    });
  }
  for (const creator of project.pitches.map((p) => p.creator).filter(Boolean)) {
    teamMap.set(creator.id, {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      role: creator.role,
      viewRole: "PRODUCER",
    });
  }

  const castConfirmed = castRoles.filter((r) => r.status === "CAST").length;
  const castPending = Math.max(0, castRoles.length - castConfirmed);
  const crewAssigned = crewNeeds.filter((n) => (n.notes ?? "").toLowerCase().includes("assign")).length;
  const crewOpen = Math.max(0, crewNeeds.length - crewAssigned);
  const locationBooked = locations.filter((l) => l.locationListing?.bookings?.[0]?.status === "CONFIRMED").length;
  const locationPending = Math.max(0, locations.length - locationBooked);
  const equipmentAllocated = equipmentItems.filter((e) => !!e.equipmentListingId).length;
  const equipmentPending = Math.max(0, equipmentItems.length - equipmentAllocated);

  const alerts = [
    ...overdueTasks.slice(0, 12).map((task) => ({
      type: "OVERDUE_TASK",
      severity: "HIGH",
      message: `Task overdue: ${task.title}`,
      taskId: task.id,
    })),
    ...(pendingContracts > 0
      ? [
          {
            type: "UNCONFIRMED_CONTRACTS",
            severity: "HIGH",
            message: `${pendingContracts} contract(s) still pending signature.`,
          },
        ]
      : []),
    ...(actualSpend > fundingSecured && fundingSecured > 0
      ? [
          {
            type: "BUDGET_OVERRUN",
            severity: "HIGH",
            message: `Actual spend exceeds secured funding by R${(actualSpend - fundingSecured).toLocaleString()}.`,
          },
        ]
      : []),
    ...(scheduleDelayed
      ? [
          {
            type: "SCHEDULE_CONFLICT",
            severity: "MEDIUM",
            message: `Schedule has conflicts or delays that require coordination.`,
          },
        ]
      : []),
    ...blockedTasks.slice(0, 12).map((task) => ({
      type: "BLOCKED_TASK",
      severity: "HIGH",
      message: `Blocked: ${task.title}${task.meta?.blockedReason ? ` — ${task.meta.blockedReason}` : ""}`,
      taskId: task.id,
    })),
    ...(castPending > 0 || crewOpen > 0 || locationPending > 0 || equipmentPending > 0
      ? [
          {
            type: "MISSING_RESOURCES",
            severity: "MEDIUM",
            message: `Some resources are still pending confirmation.`,
          },
        ]
      : []),
  ];

  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      phase: project.phase,
    },
    projectOverview: {
      projectStatus: project.phase || project.status,
      fundingStatus: funding?.status ?? "NOT_FUNDED",
      budgetStatus: {
        estimated: estimatedBudget,
        actual: actualSpend,
        variance: estimatedBudget - actualSpend,
      },
      scheduleStatus: scheduleDelayed ? "DELAYED" : "ON_TRACK",
      contractStatus: {
        confirmed: signedContracts,
        pending: pendingContracts,
      },
      keyAlerts: alerts.slice(0, 8),
    },
    tasks: enrichedTasks,
    taskSummary: {
      total: tasks.length,
      open: openTaskCount,
      done: doneTaskCount,
      completionPercent: taskProgressPercent,
      byDepartment: deptStats,
    },
    activityFeed: activities.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      metadata: a.metadata,
      user: a.user ? { id: a.user.id, name: a.user.name, email: a.user.email } : null,
      createdAt: a.createdAt,
    })),
    communication: {
      taskComments: enrichedTasks.flatMap((t) =>
        (t.meta.comments ?? []).map((c) => ({
          ...c,
          taskId: t.id,
          taskTitle: t.title,
        })),
      ),
    },
    resourceStatus: {
      cast: { confirmed: castConfirmed, pending: castPending },
      crew: { assigned: crewAssigned, available: crewOpen },
      locations: { booked: locationBooked, pending: locationPending },
      equipment: { allocated: equipmentAllocated, available: equipmentPending },
    },
    integrations: {
      budget: { synced: !!budget, estimated: estimatedBudget, actual: actualSpend },
      scheduling: { synced: schedule.length > 0, dayCount: schedule.length, conflictCount: engine?.conflicts.length ?? 0 },
      contracts: { pending: pendingContracts, signed: signedContracts },
      funding: { secured: fundingSecured, status: funding?.status ?? "NOT_FUNDED" },
    },
    team: {
      members: [...teamMap.values()],
    },
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const snapshot = await buildWorkspaceSnapshot(projectId);
  if (!snapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        action:
          | "CREATE_TASK"
          | "UPDATE_TASK"
          | "ADD_TASK_COMMENT"
          | "AUTO_GENERATE_TASKS";
        task?: {
          id?: string;
          title?: string;
          description?: string | null;
          assigneeId?: string | null;
          department?: string | null;
          priority?: string | null;
          status?: string;
          dueDate?: string | null;
          shootDayId?: string | null;
          sceneId?: string | null;
          linkedItemType?: LinkedItemType;
          linkedItemId?: string | null;
          linkedItemLabel?: string | null;
          requireSignedContracts?: boolean;
        };
        comment?: {
          taskId: string;
          body: string;
        };
      }
    | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  if (body.action === "CREATE_TASK") {
    if (!body.task?.title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    const description = composeTaskDescription(body.task.description ?? null, {
      linkedItemType: body.task.linkedItemType,
      linkedItemId: body.task.linkedItemId ?? null,
      linkedItemLabel: body.task.linkedItemLabel ?? null,
      requireSignedContracts: !!body.task.requireSignedContracts,
    });
    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title: body.task.title.trim(),
        description,
        assigneeId: body.task.assigneeId ?? null,
        department: body.task.department ?? null,
        priority: body.task.priority ?? "MEDIUM",
        status: body.task.status ?? "TODO",
        dueDate: body.task.dueDate ? new Date(body.task.dueDate) : null,
        shootDayId: body.task.shootDayId ?? null,
        sceneId: body.task.sceneId ?? null,
        createdById: userId,
      },
    });
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "TASK_CREATED",
        message: `Task created: ${task.title}`,
        metadata: JSON.stringify({ taskId: task.id }),
      },
    });
    if (task.assigneeId && task.assigneeId !== userId) {
      await prisma.notification.create({
        data: {
          userId: task.assigneeId,
          type: "TASK_ASSIGNED",
          title: "New production task assigned",
          body: task.title,
          metadata: JSON.stringify({ projectId, taskId: task.id }),
        },
      });
    }
    return NextResponse.json({ task }, { status: 201 });
  }

  if (body.action === "UPDATE_TASK") {
    if (!body.task?.id) {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }
    const existing = await prisma.projectTask.findFirst({
      where: { id: body.task.id, projectId },
    });
    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const parsed = parseTaskMeta(existing.description);
    const nextMeta: TaskMeta = {
      ...parsed.meta,
      ...(body.task.linkedItemType !== undefined ? { linkedItemType: body.task.linkedItemType } : {}),
      ...(body.task.linkedItemId !== undefined ? { linkedItemId: body.task.linkedItemId } : {}),
      ...(body.task.linkedItemLabel !== undefined ? { linkedItemLabel: body.task.linkedItemLabel } : {}),
      ...(body.task.requireSignedContracts !== undefined ? { requireSignedContracts: body.task.requireSignedContracts } : {}),
    };

    const targetStatus = body.task.status ?? existing.status;
    const incomingBlockedReason =
      typeof body.task.description === "string" && targetStatus === "BLOCKED"
        ? body.task.description.trim()
        : undefined;
    if (targetStatus === "BLOCKED") {
      const candidateReason =
        incomingBlockedReason ||
        body.task.linkedItemLabel ||
        parsed.meta.blockedReason ||
        "";
      if (!candidateReason.trim()) {
        return NextResponse.json(
          { error: "Blocked tasks require a blocker reason." },
          { status: 400 },
        );
      }
      nextMeta.blockedReason = candidateReason.trim();
      nextMeta.blockedAt = new Date().toISOString();
      nextMeta.blockedByUserId = userId;
    } else if (existing.status === "BLOCKED") {
      nextMeta.blockedReason = null;
      nextMeta.blockedAt = null;
      nextMeta.blockedByUserId = null;
    }
    if (targetStatus === "DONE" && nextMeta.requireSignedContracts) {
      const unsignedCount = await prisma.projectContract.count({
        where: { projectId, NOT: { status: { in: ["SIGNED", "EXECUTED", "CLOSED"] } } },
      });
      if (unsignedCount > 0) {
        return NextResponse.json(
          {
            error: "Cannot complete this task until required contracts are signed.",
            unsignedContracts: unsignedCount,
          },
          { status: 409 },
        );
      }
    }

    const description = composeTaskDescription(
      body.task.description !== undefined ? body.task.description : parsed.plain,
      nextMeta,
    );
    const updated = await prisma.projectTask.update({
      where: { id: body.task.id },
      data: {
        ...(body.task.title !== undefined ? { title: body.task.title } : {}),
        ...(body.task.assigneeId !== undefined ? { assigneeId: body.task.assigneeId } : {}),
        ...(body.task.department !== undefined ? { department: body.task.department } : {}),
        ...(body.task.priority !== undefined ? { priority: body.task.priority } : {}),
        ...(body.task.status !== undefined ? { status: body.task.status } : {}),
        ...(body.task.dueDate !== undefined
          ? { dueDate: body.task.dueDate ? new Date(body.task.dueDate) : null }
          : {}),
        ...(body.task.shootDayId !== undefined ? { shootDayId: body.task.shootDayId } : {}),
        ...(body.task.sceneId !== undefined ? { sceneId: body.task.sceneId } : {}),
        description,
      },
    });
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: targetStatus === "BLOCKED" ? "TASK_BLOCKED" : "TASK_UPDATED",
        message:
          targetStatus === "BLOCKED"
            ? `Task blocked: ${updated.title}${nextMeta.blockedReason ? ` — ${nextMeta.blockedReason}` : ""}`
            : `Task updated: ${updated.title}`,
        metadata: JSON.stringify({ taskId: updated.id, status: updated.status }),
      },
    });
    if (targetStatus === "BLOCKED") {
      const recipients = new Set<string>();
      if (updated.assigneeId) recipients.add(updated.assigneeId);
      const projectTeam = await prisma.originalMember.findMany({
        where: { projectId, status: "ACTIVE" },
        select: { userId: true },
        take: 40,
      });
      projectTeam.forEach((m) => recipients.add(m.userId));
      recipients.delete(userId);
      const blockedReason = nextMeta.blockedReason ?? "Task is blocked";
      if (recipients.size > 0) {
        await prisma.notification.createMany({
          data: [...recipients].map((recipientId) => ({
            userId: recipientId,
            type: "TASK_BLOCKED",
            title: "On-set task blocked",
            body: `${updated.title} — ${blockedReason}`,
            metadata: JSON.stringify({ projectId, taskId: updated.id, reason: blockedReason }),
          })),
          skipDuplicates: false,
        });
      }
    }
    return NextResponse.json({ task: updated });
  }

  if (body.action === "ADD_TASK_COMMENT") {
    if (!body.comment?.taskId || !body.comment.body?.trim()) {
      return NextResponse.json({ error: "Task and comment are required" }, { status: 400 });
    }
    const task = await prisma.projectTask.findFirst({
      where: { id: body.comment.taskId, projectId },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const parsed = parseTaskMeta(task.description);
    const commentText = body.comment.body.trim();
    const mentions = [...commentText.matchAll(/@([a-zA-Z0-9._-]+)/g)].map((m) => m[1]).filter(Boolean);
    const comments = [
      ...(parsed.meta.comments ?? []),
      {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId,
        userName: null,
        body: commentText,
        createdAt: new Date().toISOString(),
        mentions,
      },
    ];
    const description = composeTaskDescription(parsed.plain, {
      ...parsed.meta,
      comments,
    });
    await prisma.projectTask.update({ where: { id: task.id }, data: { description } });
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "TASK_COMMENT",
        message: `Comment added on task: ${task.title}`,
        metadata: JSON.stringify({ taskId: task.id, body: commentText, mentions }),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "AUTO_GENERATE_TASKS") {
    const [scenes, shootDays, locations, equipment, castRoles, props, stunts, sfx, riskItems, contracts] = await Promise.all([
      prisma.projectScene.findMany({ where: { projectId }, orderBy: { number: "asc" }, select: { id: true, number: true, heading: true } }),
      prisma.shootDay.findMany({ where: { projectId }, orderBy: { date: "asc" }, select: { id: true, date: true } }),
      prisma.breakdownLocation.findMany({ where: { projectId }, select: { id: true, name: true } }),
      prisma.equipmentPlanItem.findMany({ where: { projectId }, select: { id: true, category: true, quantity: true } }),
      prisma.castingRole.findMany({ where: { projectId, status: "CAST" }, select: { id: true, name: true } }),
      prisma.breakdownProp.findMany({ where: { projectId }, select: { id: true, name: true, sceneId: true }, take: 60 }),
      prisma.breakdownStunt.findMany({ where: { projectId }, select: { id: true, description: true, sceneId: true }, take: 40 }),
      prisma.breakdownSfx.findMany({ where: { projectId }, select: { id: true, description: true, sceneId: true }, take: 40 }),
      prisma.riskChecklistItem.findMany({
        where: { plan: { projectId }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, category: true, description: true, status: true },
        take: 60,
      }),
      prisma.projectContract.findMany({
        where: { projectId, NOT: { status: { in: ["SIGNED", "EXECUTED", "CLOSED"] } } },
        select: { id: true, type: true, status: true },
        take: 60,
      }),
    ]);
    const existing = await prisma.projectTask.findMany({
      where: { projectId },
      select: { id: true, description: true },
    });
    const existingKeys = new Set(
      existing
        .map((t) => parseTaskMeta(t.description).meta.autoTaskKey)
        .filter((v): v is string => Boolean(v)),
    );

    const candidates: Array<{
      key: string;
      title: string;
      department: string;
      linkedItemType: LinkedItemType;
      linkedItemId: string;
      linkedItemLabel: string;
      shootDayId?: string;
      sceneId?: string;
      requireSignedContracts?: boolean;
    }> = [];

    scenes.slice(0, 20).forEach((scene) => {
      candidates.push({
        key: `scene-camera-${scene.id}`,
        title: `Set up camera package for Scene ${scene.number}`,
        department: "Camera",
        linkedItemType: "SCENE",
        linkedItemId: scene.id,
        linkedItemLabel: `Scene ${scene.number}`,
        sceneId: scene.id,
      });
      candidates.push({
        key: `scene-sound-${scene.id}`,
        title: `Prepare sound capture plan for Scene ${scene.number}`,
        department: "Sound",
        linkedItemType: "SCENE",
        linkedItemId: scene.id,
        linkedItemLabel: `Scene ${scene.number}`,
        sceneId: scene.id,
      });
    });
    shootDays.slice(0, 20).forEach((day, idx) => {
      candidates.push({
        key: `day-brief-${day.id}`,
        title: `Daily production briefing for Day ${idx + 1}`,
        department: "Production",
        linkedItemType: "PRODUCTION_DAY",
        linkedItemId: day.id,
        linkedItemLabel: new Date(day.date).toISOString().slice(0, 10),
        shootDayId: day.id,
      });
    });
    locations.slice(0, 20).forEach((location) => {
      candidates.push({
        key: `location-logistics-${location.id}`,
        title: `Confirm logistics for ${location.name}`,
        department: "Logistics",
        linkedItemType: "LOCATION",
        linkedItemId: location.id,
        linkedItemLabel: location.name,
      });
    });
    equipment.slice(0, 20).forEach((item) => {
      candidates.push({
        key: `equipment-setup-${item.id}`,
        title: `Prepare ${item.category} setup (Qty ${item.quantity})`,
        department: "Production",
        linkedItemType: "EQUIPMENT",
        linkedItemId: item.id,
        linkedItemLabel: item.category,
      });
    });
    castRoles.slice(0, 20).forEach((role) => {
      candidates.push({
        key: `cast-rehearsal-${role.id}`,
        title: `Schedule rehearsal touchpoint for ${role.name}`,
        department: "Production",
        linkedItemType: "CAST",
        linkedItemId: role.id,
        linkedItemLabel: role.name,
        requireSignedContracts: true,
      });
    });
    props.forEach((prop) => {
      candidates.push({
        key: `script-prop-${prop.id}`,
        title: `Prep prop: ${prop.name}`,
        department: "Art",
        linkedItemType: "SCENE",
        linkedItemId: prop.sceneId || prop.id,
        linkedItemLabel: prop.name,
        sceneId: prop.sceneId || undefined,
        requireSignedContracts: false,
      });
    });
    stunts.forEach((stunt) => {
      candidates.push({
        key: `script-stunt-${stunt.id}`,
        title: `Safety prep for stunt: ${stunt.description || "Stunt action"}`,
        department: "Safety",
        linkedItemType: "SCENE",
        linkedItemId: stunt.sceneId || stunt.id,
        linkedItemLabel: "Stunt",
        sceneId: stunt.sceneId || undefined,
        requireSignedContracts: true,
      });
    });
    sfx.forEach((item) => {
      candidates.push({
        key: `script-sfx-${item.id}`,
        title: `Coordinate SFX: ${item.description || "SFX setup"}`,
        department: "Production",
        linkedItemType: "SCENE",
        linkedItemId: item.sceneId || item.id,
        linkedItemLabel: "SFX",
        sceneId: item.sceneId || undefined,
      });
    });
    riskItems.forEach((risk) => {
      candidates.push({
        key: `risk-${risk.id}`,
        title: `Resolve risk (${risk.category}): ${risk.description.slice(0, 72)}`,
        department: "Safety",
        linkedItemType: "OTHER",
        linkedItemId: risk.id,
        linkedItemLabel: risk.category,
      });
    });
    contracts.forEach((contract) => {
      candidates.push({
        key: `contract-${contract.id}`,
        title: `Confirm contract (${contract.type}) before on-set work`,
        department: "Production",
        linkedItemType: "CONTRACT",
        linkedItemId: contract.id,
        linkedItemLabel: `${contract.type} contract`,
      });
    });

    const toCreate = candidates.filter((c) => !existingKeys.has(c.key)).slice(0, 80);
    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0, message: "No new automation tasks were needed." });
    }
    await prisma.$transaction(
      toCreate.map((candidate) =>
        prisma.projectTask.create({
          data: {
            projectId,
            title: candidate.title,
            department: candidate.department,
            status: "TODO",
            priority: "MEDIUM",
            shootDayId: candidate.shootDayId ?? null,
            sceneId: candidate.sceneId ?? null,
            createdById: userId,
            description: composeTaskDescription(null, {
              linkedItemType: candidate.linkedItemType,
              linkedItemId: candidate.linkedItemId,
              linkedItemLabel: candidate.linkedItemLabel,
              autoTaskKey: candidate.key,
              requireSignedContracts:
                candidate.requireSignedContracts ||
                candidate.linkedItemType === "CAST" ||
                candidate.linkedItemType === "CREW" ||
                candidate.linkedItemType === "LOCATION" ||
                candidate.linkedItemType === "EQUIPMENT",
            }),
          },
        }),
      ),
    );
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "TASK_AUTOMATION_RUN",
        message: `Auto-generated ${toCreate.length} production coordination tasks.`,
      },
    });
    return NextResponse.json({ created: toCreate.length });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
