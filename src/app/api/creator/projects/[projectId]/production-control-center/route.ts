import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { buildProductionDataEngine } from "@/lib/production-day-engine";
import {
  computeControlAlerts,
  mergeKeyedStatuses,
  mergeLiveView,
  mergeSceneProgress,
  asRecord,
} from "@/lib/production-control-center";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseAckList(v: unknown): Set<string> {
  if (!Array.isArray(v)) return new Set();
  return new Set(v.filter((x): x is string => typeof x === "string"));
}

async function resolveShootDay(projectId: string, shootDayId?: string | null, date?: string | null) {
  const days = await prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    include: {
      scenes: { orderBy: { order: "asc" }, include: { scene: true } },
    },
  });
  if (shootDayId) {
    return days.find((d) => d.id === shootDayId) ?? null;
  }
  if (date?.trim()) {
    const target = date.trim().slice(0, 10);
    return days.find((d) => ymd(d.date) === target) ?? null;
  }
  const today = ymd(new Date());
  const todayMatch = days.find((d) => ymd(d.date) === today);
  if (todayMatch) return todayMatch;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = days.find((d) => d.date.getTime() >= startOfToday.getTime());
  return upcoming ?? days[0] ?? null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const { searchParams } = new URL(req.url);
  const shootDayId = searchParams.get("shootDayId");
  const date = searchParams.get("date");

  const shootDaysBrief = await prisma.shootDay.findMany({
    where: { projectId },
    select: { id: true, date: true, status: true, callTime: true, locationSummary: true },
    orderBy: { date: "asc" },
  });

  const shootDay = await resolveShootDay(projectId, shootDayId, date);
  if (!shootDay) {
    return NextResponse.json({
      controlBoardDbReady: true,
      shootDay: null,
      shootDaysBrief,
      productionDay: null,
      live: null,
      tasks: [],
      incidents: [],
      riskItems: [],
      contractSummary: { total: 0, signed: 0 },
      equipmentPlan: [],
      alerts: [],
      teamMembers: [],
    });
  }

  const engine = await buildProductionDataEngine(prisma, projectId, access.userId);
  const productionDay = (engine?.productionDays ?? []).find((d) => d.id === shootDay.id) ?? null;

  let controlBoardDbReady = true;
  let board: Awaited<ReturnType<typeof prisma.shootDayControlBoard.findUnique>> = null;
  try {
    board = await prisma.shootDayControlBoard.findUnique({ where: { shootDayId: shootDay.id } });
  } catch (e) {
    if (isPrismaMissingTable(e, "ShootDayControlBoard")) {
      controlBoardDbReady = false;
      board = null;
    } else {
      throw e;
    }
  }

  const live = mergeLiveView(productionDay, {
    sceneProgress: board?.sceneProgress ?? null,
    castStatus: board?.castStatus ?? null,
    crewStatus: board?.crewStatus ?? null,
    equipmentStatus: board?.equipmentStatus ?? null,
    locationStatus: board?.locationStatus ?? null,
  }, shootDay.scenes);

  const tasks = await prisma.projectTask.findMany({
    where: { projectId, shootDayId: shootDay.id },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });

  const incidents = await prisma.incidentReport.findMany({
    where: {
      projectId,
      OR: [{ shootDayId: shootDay.id }, { shootDayId: null, resolved: false }],
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      createdBy: { select: { id: true, name: true } },
      resolutionOwner: { select: { id: true, name: true } },
    },
  });

  const riskPlan = await prisma.riskPlan.findUnique({
    where: { projectId },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });

  const contracts = await prisma.projectContract.findMany({ where: { projectId } });
  const signed = contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED"].includes(c.status)).length;

  const equipmentPlan = await prisma.equipmentPlanItem.findMany({
    where: { projectId },
    include: { equipmentListing: { select: { id: true, category: true, companyName: true } } },
    orderBy: { createdAt: "asc" },
  });

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      pitches: { include: { creator: { select: { id: true, name: true, email: true } } } },
    },
  });

  const teamMembers: { id: string; name: string | null; email: string | null }[] = [];
  const seen = new Set<string>();
  for (const m of project?.members ?? []) {
    if (!seen.has(m.user.id)) {
      seen.add(m.user.id);
      teamMembers.push({ id: m.user.id, name: m.user.name, email: m.user.email });
    }
  }
  for (const p of project?.pitches ?? []) {
    if (p.creator && !seen.has(p.creator.id)) {
      seen.add(p.creator.id);
      teamMembers.push({ id: p.creator.id, name: p.creator.name, email: p.creator.email });
    }
  }

  const sceneMeta = shootDay.scenes.map((link) => {
    const est =
      productionDay?.scenes.find((s) => s.sceneId === link.sceneId)?.estimatedShootDurationMinutes ?? 45;
    return { shootDaySceneId: link.id, estimatedMinutes: est, number: link.scene?.number ?? "?" };
  });

  const ack = parseAckList(board?.acknowledgedAlerts);
  const alerts = computeControlAlerts({
    shootDay: { id: shootDay.id, callTime: shootDay.callTime, date: shootDay.date },
    sceneProgress: live.sceneProgress,
    sceneMeta,
    castStatus: live.castStatus,
    crewStatus: live.crewStatus,
    equipmentStatus: live.equipmentStatus,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority ?? null,
      dueDate: t.dueDate,
    })),
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      resolved: i.resolved,
      category: i.category,
    })),
    acknowledged: ack,
  });

  return NextResponse.json({
    controlBoardDbReady,
    shootDaysBrief,
    shootDay: {
      id: shootDay.id,
      date: shootDay.date.toISOString(),
      unit: shootDay.unit,
      callTime: shootDay.callTime,
      wrapTime: shootDay.wrapTime,
      status: shootDay.status,
      locationSummary: shootDay.locationSummary,
      scenesBeingShot: shootDay.scenesBeingShot,
      dayNotes: shootDay.dayNotes,
      scenes: shootDay.scenes.map((s) => ({
        shootDaySceneId: s.id,
        order: s.order,
        sceneId: s.sceneId,
        number: s.scene?.number ?? "?",
        heading: s.scene?.heading ?? null,
      })),
    },
    productionDay,
    live,
    tasks,
    incidents,
    riskItems: (riskPlan?.items ?? []).filter((r) => r.status !== "DONE"),
    contractSummary: { total: contracts.length, signed },
    equipmentPlan,
    alerts,
    acknowledgedAlertIds: [...ack],
    teamMembers,
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  const shootDayId = typeof body.shootDayId === "string" ? body.shootDayId : null;
  if (!shootDayId) {
    return NextResponse.json({ error: "shootDayId is required" }, { status: 400 });
  }

  const day = await prisma.shootDay.findFirst({ where: { id: shootDayId, projectId } });
  if (!day) return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });

  try {
    await prisma.shootDayControlBoard.upsert({
      where: { shootDayId },
      create: { shootDayId, projectId },
      update: {},
    });
  } catch (e) {
    if (isPrismaMissingTable(e, "ShootDayControlBoard")) {
      return NextResponse.json(
        {
          error: "Shoot day control board table is missing.",
          hint: "Apply schema to your database: npx prisma migrate deploy (production) or npx prisma db push (development).",
        },
        { status: 503 },
      );
    }
    throw e;
  }

  const readBoardJson = async () => {
    const fresh = await prisma.shootDayControlBoard.findUnique({ where: { shootDayId } });
    return fresh!;
  };

  const patchBoard = async (data: Record<string, unknown>) => {
    await prisma.shootDayControlBoard.update({
      where: { shootDayId },
      data: data as any,
    });
  };

  if (action === "SET_SCENE_PROGRESS") {
    const shootDaySceneId = String(body.shootDaySceneId ?? "");
    const link = await prisma.shootDayScene.findFirst({
      where: { id: shootDaySceneId, shootDayId },
    });
    if (!link) return NextResponse.json({ error: "Invalid shoot day scene" }, { status: 400 });
    const b = await readBoardJson();
    const patch: Parameters<typeof mergeSceneProgress>[2] = {};
    if (typeof body.status === "string") patch.status = body.status as "NOT_STARTED" | "IN_PROGRESS" | "DONE";
    if (body.actualStartAt !== undefined) patch.actualStartAt = body.actualStartAt ? String(body.actualStartAt) : null;
    if (body.actualEndAt !== undefined) patch.actualEndAt = body.actualEndAt ? String(body.actualEndAt) : null;
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
    const next = mergeSceneProgress(b.sceneProgress, shootDaySceneId, patch);
    await patchBoard({ sceneProgress: next });
    return NextResponse.json({ ok: true });
  }

  if (action === "SET_CAST_STATUS" || action === "SET_CREW_STATUS" || action === "SET_EQUIPMENT_STATUS") {
    const key = String(body.key ?? "");
    const status = String(body.status ?? "");
    if (!key || !status) return NextResponse.json({ error: "key and status required" }, { status: 400 });
    const b = await readBoardJson();
    if (action === "SET_CAST_STATUS") {
      await patchBoard({ castStatus: mergeKeyedStatuses(b.castStatus, key, status) });
    } else if (action === "SET_CREW_STATUS") {
      await patchBoard({ crewStatus: mergeKeyedStatuses(b.crewStatus, key, status) });
    } else {
      await patchBoard({
        equipmentStatus: mergeKeyedStatuses(b.equipmentStatus, key, status),
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "SET_LOCATION_STATUS") {
    const b = await readBoardJson();
    const cur = asRecord(b.locationStatus);
    const next = {
      ...cur,
      ...(body.access !== undefined ? { access: body.access } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    };
    await patchBoard({ locationStatus: next });
    return NextResponse.json({ ok: true });
  }

  if (action === "ACK_ALERT") {
    const alertId = String(body.alertId ?? "");
    if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });
    const b = await readBoardJson();
    const list = Array.from(parseAckList(b.acknowledgedAlerts));
    if (!list.includes(alertId)) list.push(alertId);
    await patchBoard({ acknowledgedAlerts: list });
    return NextResponse.json({ ok: true });
  }

  if (action === "UPDATE_TASK") {
    const taskId = String(body.taskId ?? "");
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
    const task = await prisma.projectTask.findFirst({ where: { id: taskId, projectId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        ...(typeof body.priority === "string" ? { priority: body.priority } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "LOG_INCIDENT") {
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || !description) {
      return NextResponse.json({ error: "title and description required" }, { status: 400 });
    }
    const incident = await prisma.incidentReport.create({
      data: {
        projectId,
        shootDayId,
        title,
        description,
        severity: typeof body.severity === "string" ? body.severity : "MEDIUM",
        category: typeof body.category === "string" ? body.category : "OTHER",
        location: typeof body.location === "string" ? body.location : null,
        resolutionOwnerId: typeof body.resolutionOwnerId === "string" ? body.resolutionOwnerId : null,
        createdById: userId,
      },
    });
    return NextResponse.json({ incident }, { status: 201 });
  }

  if (action === "UPDATE_INCIDENT") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = await prisma.incidentReport.findFirst({ where: { id, projectId } });
    if (!existing) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    const updated = await prisma.incidentReport.update({
      where: { id },
      data: {
        ...(typeof body.resolved === "boolean"
          ? { resolved: body.resolved, resolvedAt: body.resolved ? new Date() : null }
          : {}),
        ...(typeof body.severity === "string" ? { severity: body.severity } : {}),
        ...(typeof body.category === "string" ? { category: body.category } : {}),
        ...(body.resolutionOwnerId !== undefined
          ? { resolutionOwnerId: body.resolutionOwnerId ? String(body.resolutionOwnerId) : null }
          : {}),
      },
    });
    return NextResponse.json({ incident: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
