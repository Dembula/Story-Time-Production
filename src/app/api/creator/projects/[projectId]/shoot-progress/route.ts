import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

type SceneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "SKIPPED";

type SceneProgressOverride = {
  status?: SceneStatus | "DONE";
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  notes?: string | null;
  completionPercent?: number | null;
  manualStatus?: SceneStatus;
  manualActualShootDayId?: string | null;
  manualUpdatedAt?: string | null;
  manualUpdatedByUserId?: string | null;
  history?: Array<{
    at: string;
    byUserId: string | null;
    patch: Record<string, unknown>;
  }>;
};

type EquipmentTrackingMeta = {
  assignedSceneIds?: string[];
  assignedShootDayIds?: string[];
  currentStatus?: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sceneCompletionFromEntry(entry: SceneProgressOverride | null | undefined): number {
  if (!entry) return 0;
  if (typeof entry.completionPercent === "number") return Math.max(0, Math.min(100, Math.round(entry.completionPercent)));
  if (entry.manualStatus === "COMPLETED" || entry.status === "DONE") return 100;
  if (entry.manualStatus === "IN_PROGRESS" || entry.status === "IN_PROGRESS") return 50;
  return 0;
}

function normalizeSceneStatus(entry: SceneProgressOverride | null | undefined): SceneStatus {
  const v = entry?.manualStatus ?? entry?.status ?? "NOT_STARTED";
  if (v === "DONE") return "COMPLETED";
  if (v === "NOT_STARTED" || v === "IN_PROGRESS" || v === "COMPLETED" || v === "DELAYED" || v === "SKIPPED") return v;
  return "NOT_STARTED";
}

function csv(value: unknown): string {
  const t = `${value ?? ""}`.replace(/"/g, '""');
  return /[",\n]/.test(t) ? `"${t}"` : t;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): Buffer {
  const maxLines = Math.min(lines.length, 40);
  const contentLines = ["BT", "/F1 11 Tf", "50 790 Td"];
  for (let i = 0; i < maxLines; i += 1) {
    if (i > 0) contentLines.push("0 -16 Td");
    contentLines.push(`(${pdfEscape(lines[i] ?? "")}) Tj`);
  }
  contentLines.push("ET");
  const content = contentLines.join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const xref: number[] = [0];
  for (const obj of objects) {
    xref.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < xref.length; i += 1) {
    pdf += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const format = req.nextUrl.searchParams.get("format")?.toLowerCase() ?? "json";

  const [shootDays, boards, tasks, equipmentItems, incidents, riskPlan, contracts, castRoles, crewNeeds] =
    await Promise.all([
      prisma.shootDay.findMany({
        where: { projectId },
        orderBy: { date: "asc" },
        include: {
          scenes: {
            orderBy: { order: "asc" },
            include: { scene: { select: { id: true, number: true, heading: true, storyDay: true, timeOfDay: true, pageCount: true } } },
          },
        },
      }),
      prisma.shootDayControlBoard.findMany({
        where: { projectId },
        select: { shootDayId: true, sceneProgress: true },
      }),
      prisma.projectTask.findMany({
        where: { projectId },
        select: { id: true, status: true, sceneId: true, shootDayId: true, department: true },
      }),
      prisma.equipmentPlanItem.findMany({
        where: { projectId },
        select: { id: true, quantity: true, notes: true },
      }),
      prisma.incidentReport.findMany({
        where: { projectId, resolved: false },
        select: { id: true, title: true, severity: true, shootDayId: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.riskPlan.findUnique({
        where: { projectId },
        include: { items: { select: { id: true, category: true, status: true } } },
      }),
      prisma.projectContract.findMany({
        where: { projectId },
        select: { id: true, status: true },
      }),
      prisma.castingRole.findMany({
        where: { projectId },
        select: { id: true, status: true },
      }),
      prisma.crewRoleNeed.findMany({
        where: { projectId },
        select: { id: true, notes: true },
      }),
    ]);

  const boardByDay = new Map(boards.map((b) => [b.shootDayId, asRecord(b.sceneProgress)]));
  const sceneRows: Array<Record<string, unknown>> = [];
  const dayRows: Array<Record<string, unknown>> = [];
  const todayMs = new Date().setHours(0, 0, 0, 0);

  const equipmentByScene = new Map<string, { total: number; ready: number }>();
  for (const eq of equipmentItems) {
    const meta = parseEmbeddedMeta<EquipmentTrackingMeta>(eq.notes).meta ?? {};
    const assignedScenes = meta.assignedSceneIds ?? [];
    const ready = ["DELIVERED", "IN_USE", "IDLE", "RETURNED"].includes(meta.currentStatus ?? "") ? eq.quantity : 0;
    for (const sceneId of assignedScenes) {
      const cur = equipmentByScene.get(sceneId) ?? { total: 0, ready: 0 };
      cur.total += eq.quantity;
      cur.ready += ready;
      equipmentByScene.set(sceneId, cur);
    }
  }

  for (const day of shootDays) {
    const sceneProgress = boardByDay.get(day.id) ?? {};
    let completed = 0;
    let delayed = 0;
    let totalCompletion = 0;
    let totalEstimated = 0;
    let totalActual = 0;

    for (const link of day.scenes) {
      const entry = asRecord(sceneProgress[link.id]) as SceneProgressOverride;
      const status = normalizeSceneStatus(entry);
      const completionPercent = sceneCompletionFromEntry(entry);
      const est = Math.max(15, Math.round((link.scene?.pageCount ?? 1) * 8));
      const start = entry.actualStartAt ? new Date(entry.actualStartAt).getTime() : NaN;
      const end = entry.actualEndAt ? new Date(entry.actualEndAt).getTime() : NaN;
      const actualDurationMinutes =
        Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.round((end - start) / 60000) : null;
      const driftMinutes =
        actualDurationMinutes != null && est > 0 ? actualDurationMinutes - est : null;
      const sceneTasks = tasks.filter((t) => t.sceneId === link.sceneId || t.shootDayId === day.id);
      const doneTasks = sceneTasks.filter((t) => t.status === "DONE" || t.status === "COMPLETED").length;
      const sceneTaskPercent = sceneTasks.length ? Math.round((doneTasks / sceneTasks.length) * 100) : null;
      const eq = equipmentByScene.get(link.sceneId ?? "") ?? { total: 0, ready: 0 };
      const equipmentReadyPercent = eq.total > 0 ? Math.round((eq.ready / eq.total) * 100) : null;
      const relatedIncidents = incidents.filter((i) => i.shootDayId === day.id);

      if (completionPercent >= 100 || status === "COMPLETED") completed += 1;
      if (status === "DELAYED") delayed += 1;
      totalCompletion += completionPercent;
      totalEstimated += est;
      totalActual += actualDurationMinutes ?? 0;

      sceneRows.push({
        shootDayId: day.id,
        shootDayDate: day.date.toISOString(),
        shootDayStatus: day.status,
        shootDayNumber: link.order,
        shootDaySceneId: link.id,
        sceneId: link.sceneId,
        sceneNumber: link.scene?.number ?? "?",
        heading: link.scene?.heading ?? null,
        intExt: link.scene?.storyDay ?? null,
        dayNight: link.scene?.timeOfDay ?? null,
        plannedShootDayId: day.id,
        actualShootDayId: entry.manualActualShootDayId ?? (completionPercent > 0 ? day.id : null),
        status,
        estimatedDurationMinutes: est,
        actualDurationMinutes,
        completionPercent,
        delayMinutes: driftMinutes && driftMinutes > 0 ? driftMinutes : 0,
        overrunMinutes: driftMinutes && driftMinutes > 0 ? driftMinutes : 0,
        earlyMinutes: driftMinutes && driftMinutes < 0 ? Math.abs(driftMinutes) : 0,
        notes: entry.notes ?? null,
        actualStartAt: entry.actualStartAt ?? null,
        actualEndAt: entry.actualEndAt ?? null,
        manualUpdatedAt: entry.manualUpdatedAt ?? null,
        manualUpdatedByUserId: entry.manualUpdatedByUserId ?? null,
        auditHistory: entry.history ?? [],
        taskProgressPercent: sceneTaskPercent,
        equipmentReadyPercent,
        relatedIncidentCount: relatedIncidents.length,
        hasBlockers: sceneTasks.some((t) => t.status === "BLOCKED"),
      });
    }

    const completionPercent = day.scenes.length ? Math.round(totalCompletion / day.scenes.length) : 0;
    const delayMinutes = Math.max(0, totalActual - totalEstimated);
    const remaining = Math.max(0, day.scenes.length - completed);
    const behindSchedule = day.date.getTime() < todayMs && completionPercent < 100;
    dayRows.push({
      shootDayId: day.id,
      date: day.date.toISOString(),
      status: day.status,
      totalScenesScheduled: day.scenes.length,
      scenesCompleted: completed,
      scenesRemaining: remaining,
      delayedScenes: delayed,
      completionPercent,
      delayMinutes,
      incidentCount: incidents.filter((i) => i.shootDayId === day.id).length,
      behindSchedule,
    });
  }

  const totalScenes = sceneRows.length;
  const scenesCompleted = sceneRows.filter((s) => toNum(s.completionPercent) >= 100 || s.status === "COMPLETED").length;
  const scenesRemaining = Math.max(0, totalScenes - scenesCompleted);
  const overallPercent = totalScenes > 0 ? Math.round((scenesCompleted / totalScenes) * 100) : 0;
  const estimatedTimelineDays = shootDays.length;
  const actualTimelineDays = dayRows.filter((d) => toNum(d.completionPercent) > 0).length;
  const scheduleDriftDays = Math.max(0, actualTimelineDays - estimatedTimelineDays);
  const unresolvedRiskCount = (riskPlan?.items ?? []).filter((i) => i.status !== "DONE").length;
  const signedContracts = contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED"].includes(c.status)).length;
  const castConfirmed = castRoles.filter((r) => r.status === "CAST").length;
  const crewAssigned = crewNeeds.filter((c) => (c.notes ?? "").toLowerCase().includes("assign")).length;

  const alerts = [
    ...dayRows
      .filter((d) => Boolean(d.behindSchedule))
      .map((d) => ({
        type: "BEHIND_SCHEDULE_DAY",
        severity: "HIGH",
        message: `Shoot day ${new Date(`${d.date}`).toLocaleDateString()} is behind schedule.`,
      })),
    ...sceneRows
      .filter((s) => s.status === "DELAYED")
      .slice(0, 25)
      .map((s) => ({
        type: "DELAYED_SCENE",
        severity: "MEDIUM",
        message: `Scene ${s.sceneNumber} delayed.`,
      })),
    ...(unresolvedRiskCount > 0
      ? [{ type: "OPEN_RISKS", severity: "MEDIUM", message: `${unresolvedRiskCount} open risk item(s).` }]
      : []),
    ...(incidents.length > 0
      ? [{ type: "OPEN_INCIDENTS", severity: "HIGH", message: `${incidents.length} unresolved incident(s).` }]
      : []),
  ];

  const payload = {
    overall: {
      totalScenes,
      scenesCompleted,
      scenesRemaining,
      completionPercent: overallPercent,
      estimatedTimelineDays,
      actualTimelineDays,
      scheduleDriftDays,
      castConfirmed,
      castTotal: castRoles.length,
      crewAssigned,
      crewTotal: crewNeeds.length,
      contractsSigned: signedContracts,
      contractsTotal: contracts.length,
      unresolvedRiskCount,
      unresolvedIncidentCount: incidents.length,
    },
    days: dayRows,
    scenes: sceneRows,
    alerts,
    generatedAt: new Date().toISOString(),
  };

  if (req.nextUrl.searchParams.get("report") === "producer-pdf") {
    const lines = [
      `Story Time Producer Summary`,
      `Generated: ${new Date().toLocaleString()}`,
      `Project: ${projectId}`,
      `Overall completion: ${overallPercent}%`,
      `Scenes completed: ${scenesCompleted}/${totalScenes}`,
      `Schedule drift: ${scheduleDriftDays} day(s)`,
      `Open incidents: ${incidents.length}`,
      `Open risks: ${unresolvedRiskCount}`,
      `Contracts signed: ${signedContracts}/${contracts.length}`,
      "---- Day performance ----",
      ...dayRows.slice(0, 18).map(
        (d) =>
          `${new Date(`${d.date}`).toLocaleDateString()} | ${d.completionPercent}% | ${d.scenesCompleted}/${d.totalScenesScheduled} scenes | delay ${d.delayMinutes}m`,
      ),
      "---- Alerts ----",
      ...(alerts.length > 0 ? alerts.slice(0, 12).map((a) => `${a.severity}: ${a.message}`) : ["No active alerts"]),
    ];
    const pdf = buildSimplePdf(lines);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="shoot-progress-producer-summary-${projectId}.pdf"`,
      },
    });
  }

  if (format === "csv") {
    const lines: string[] = [];
    lines.push(
      [
        "shootDayDate",
        "shootDayStatus",
        "sceneNumber",
        "heading",
        "status",
        "completionPercent",
        "estimatedDurationMinutes",
        "actualDurationMinutes",
        "overrunMinutes",
        "earlyMinutes",
        "taskProgressPercent",
        "equipmentReadyPercent",
        "relatedIncidentCount",
        "notes",
      ].join(","),
    );
    for (const s of sceneRows) {
      lines.push(
        [
          s.shootDayDate,
          s.shootDayStatus,
          s.sceneNumber,
          s.heading,
          s.status,
          s.completionPercent,
          s.estimatedDurationMinutes,
          s.actualDurationMinutes,
          s.overrunMinutes,
          s.earlyMinutes,
          s.taskProgressPercent,
          s.equipmentReadyPercent,
          s.relatedIncidentCount,
          s.notes,
        ]
          .map(csv)
          .join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shoot-progress-${projectId}.csv"`,
      },
    });
  }

  return NextResponse.json(payload);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        shootDayId: string;
        shootDaySceneId?: string;
        sceneId?: string;
        status?: SceneStatus;
        actualStartAt?: string | null;
        actualEndAt?: string | null;
        completionPercent?: number | null;
        notes?: string | null;
        actualShootDayId?: string | null;
      }
    | null;

  if (!body?.shootDayId || (!body.shootDaySceneId && !body.sceneId)) {
    return NextResponse.json({ error: "shootDayId and shootDaySceneId/sceneId are required" }, { status: 400 });
  }

  const shootDay = await prisma.shootDay.findFirst({
    where: { id: body.shootDayId, projectId },
    include: { scenes: true },
  });
  if (!shootDay) return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });

  const link = body.shootDaySceneId
    ? shootDay.scenes.find((s) => s.id === body.shootDaySceneId)
    : shootDay.scenes.find((s) => s.sceneId === body.sceneId);
  if (!link) return NextResponse.json({ error: "Scene link not found on shoot day" }, { status: 404 });

  await prisma.shootDayControlBoard.upsert({
    where: { shootDayId: shootDay.id },
    create: { shootDayId: shootDay.id, projectId },
    update: {},
  });
  const board = await prisma.shootDayControlBoard.findUnique({ where: { shootDayId: shootDay.id } });
  const sceneProgress = asRecord(board?.sceneProgress);
  const current = asRecord(sceneProgress[link.id]) as SceneProgressOverride;
  const patch: SceneProgressOverride = {
    ...(body.status !== undefined ? { status: body.status, manualStatus: body.status } : {}),
    ...(body.actualStartAt !== undefined ? { actualStartAt: body.actualStartAt || null } : {}),
    ...(body.actualEndAt !== undefined ? { actualEndAt: body.actualEndAt || null } : {}),
    ...(body.completionPercent !== undefined ? { completionPercent: body.completionPercent == null ? null : Math.max(0, Math.min(100, Math.round(body.completionPercent))) } : {}),
    ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    ...(body.actualShootDayId !== undefined ? { manualActualShootDayId: body.actualShootDayId || null } : {}),
    manualUpdatedAt: new Date().toISOString(),
    manualUpdatedByUserId: access.userId ?? null,
  };
  const history = Array.isArray(current.history) ? current.history : [];
  history.push({
    at: new Date().toISOString(),
    byUserId: access.userId ?? null,
    patch: patch as unknown as Record<string, unknown>,
  });
  const next: SceneProgressOverride = {
    ...current,
    ...patch,
    history: history.slice(-30),
  };

  await prisma.shootDayControlBoard.update({
    where: { shootDayId: shootDay.id },
    data: { sceneProgress: { ...sceneProgress, [link.id]: next } as any },
  });

  return NextResponse.json({ ok: true, shootDaySceneId: link.id });
}

