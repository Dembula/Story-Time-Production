import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedMeta, parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";
import { validateStorageUrlList } from "@/lib/storage-origin";
import { ensureCloudflareStreamPlaybackUrl } from "@/lib/cloudflare-stream";

async function ensureIncidentAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type IncidentMeta = {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  occurredAt?: string | null;
  acknowledgedAt?: string | null;
  linkedSceneId?: string | null;
  involvedUserIds?: string[];
  involvedNames?: string[];
  equipmentIds?: string[];
  equipmentLabels?: string[];
  mediaUrls?: string[];
  videoUrls?: string[];
  actionSteps?: string[];
  resolutionNotes?: string | null;
  rootCause?: string | null;
  timeline?: Array<{
    at: string;
    byUserId: string | null;
    action: string;
    note?: string | null;
    patch?: Record<string, unknown>;
  }>;
  linkedTaskIds?: string[];
  linkedRiskItemIds?: string[];
  linkedContractIds?: string[];
};

function parseCategory(value: string | null | undefined): string {
  const raw = (value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!raw) return "OTHER";
  return raw;
}

function parseSeverity(value: string | null | undefined): IncidentSeverity {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "LOW" || raw === "MEDIUM" || raw === "HIGH" || raw === "CRITICAL") return raw;
  return "LOW";
}

function parseStatus(value: string | null | undefined): IncidentStatus {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "OPEN" || raw === "IN_PROGRESS" || raw === "RESOLVED" || raw === "CLOSED") return raw;
  return "OPEN";
}

function parsePriority(value: string | null | undefined): IncidentPriority {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "LOW" || raw === "MEDIUM" || raw === "HIGH" || raw === "CRITICAL") return raw;
  return "MEDIUM";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const severityFilter = url.searchParams.get("severity");
  const categoryFilter = url.searchParams.get("category");
  const shootDayIdFilter = url.searchParams.get("shootDayId");
  const sceneIdFilter = url.searchParams.get("sceneId");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const [incidentsRaw, shootDays, scenes, equipment, tasks] = await Promise.all([
    prisma.incidentReport.findMany({
      where: { projectId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        resolutionOwner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      select: { id: true, date: true, status: true },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true },
    }),
    prisma.equipmentPlanItem.findMany({
      where: { projectId },
      select: { id: true, category: true, description: true },
    }),
    prisma.projectTask.findMany({
      where: { projectId },
      select: { id: true, title: true, status: true },
      take: 200,
    }),
  ]);

  const incidents = incidentsRaw
    .map((incident) => {
      const parsed = parseEmbeddedMeta<IncidentMeta>(incident.description);
      const meta = parsed.meta ?? {};
      const status = parseStatus(meta.status ?? (incident.resolved ? "RESOLVED" : "OPEN"));
      const severity = parseSeverity(incident.severity);
      const priority = parsePriority(meta.priority ?? severity);
      const occurredAt = meta.occurredAt ?? incident.createdAt.toISOString();
      const timeline = (meta.timeline ?? []).slice(-200);
      return {
        id: incident.id,
        projectId: incident.projectId,
        shootDayId: incident.shootDayId ?? null,
        title: incident.title,
        description: parsed.plain ?? "",
        severity,
        category: parseCategory(incident.category),
        location: incident.location ?? null,
        resolved: incident.resolved,
        createdAt: incident.createdAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() ?? null,
        createdBy: incident.createdBy,
        resolutionOwner: incident.resolutionOwner,
        meta: {
          status,
          priority,
          occurredAt,
          acknowledgedAt: meta.acknowledgedAt ?? null,
          linkedSceneId: meta.linkedSceneId ?? null,
          involvedUserIds: meta.involvedUserIds ?? [],
          involvedNames: meta.involvedNames ?? [],
          equipmentIds: meta.equipmentIds ?? [],
          equipmentLabels: meta.equipmentLabels ?? [],
          mediaUrls: meta.mediaUrls ?? [],
          videoUrls: meta.videoUrls ?? [],
          actionSteps: meta.actionSteps ?? [],
          resolutionNotes: meta.resolutionNotes ?? null,
          rootCause: meta.rootCause ?? null,
          linkedTaskIds: meta.linkedTaskIds ?? [],
          linkedRiskItemIds: meta.linkedRiskItemIds ?? [],
          linkedContractIds: meta.linkedContractIds ?? [],
          timeline,
          timeToResolveMinutes:
            status === "RESOLVED" || status === "CLOSED"
              ? Math.max(
                  0,
                  Math.round(
                    ((incident.resolvedAt?.getTime() ?? Date.now()) - new Date(occurredAt).getTime()) /
                      60000,
                  ),
                )
              : null,
        },
      };
    })
    .filter((item) => {
      if (statusFilter && item.meta.status !== statusFilter) return false;
      if (severityFilter && item.severity !== severityFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (shootDayIdFilter && item.shootDayId !== shootDayIdFilter) return false;
      if (sceneIdFilter && item.meta.linkedSceneId !== sceneIdFilter) return false;
      if (
        q &&
        ![
          item.title,
          item.description,
          item.category,
          item.location ?? "",
          ...(item.meta.involvedNames ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });

  const severityWeight: Record<IncidentSeverity, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  const openIncidents = incidents.filter((i) => i.meta.status !== "RESOLVED" && i.meta.status !== "CLOSED");
  const recurringMap = incidents.reduce((acc, incident) => {
    const key = `${incident.category}|${incident.location ?? "NO_LOCATION"}|${incident.meta.equipmentIds?.[0] ?? "NO_EQUIPMENT"}`;
    acc.set(key, [...(acc.get(key) ?? []), incident]);
    return acc;
  }, new Map<string, typeof incidents>());
  const recurringIssues = [...recurringMap.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => ({
      key,
      count: rows.length,
      category: rows[0].category,
      location: rows[0].location,
      equipmentId: rows[0].meta.equipmentIds?.[0] ?? null,
      latestIncidentId: rows[0].id,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const activeAlerts = [
    ...openIncidents
      .filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL")
      .map((i) => ({
        type: "HIGH_SEVERITY_INCIDENT",
        severity: i.severity,
        message: `${i.severity} incident open: ${i.title}`,
        incidentId: i.id,
      })),
    ...openIncidents
      .filter((i) => Date.now() - new Date(i.createdAt).getTime() > 12 * 60 * 60 * 1000)
      .map((i) => ({
        type: "UNRESOLVED_INCIDENT",
        severity: i.severity,
        message: `Incident unresolved >12h: ${i.title}`,
        incidentId: i.id,
      })),
    ...recurringIssues.map((rec) => ({
      type: "RECURRING_ISSUE",
      severity: "MEDIUM",
      message: `Recurring ${rec.category} issue (${rec.count}x)`,
      incidentId: rec.latestIncidentId,
    })),
  ];

  const byStatus = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((status) => ({
    status,
    count: incidents.filter((i) => i.meta.status === status).length,
  }));
  const bySeverity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => ({
    severity,
    count: incidents.filter((i) => i.severity === severity).length,
  }));
  const impactScore = incidents.reduce((sum, i) => sum + severityWeight[i.severity as IncidentSeverity], 0);
  const avgResolutionMinutesResolved =
    incidents
      .filter((i) => i.meta.timeToResolveMinutes != null)
      .reduce((sum, i, _, arr) => sum + (i.meta.timeToResolveMinutes ?? 0) / Math.max(1, arr.length), 0) || 0;

  if (url.searchParams.get("format") === "csv") {
    const header = [
      "id",
      "title",
      "category",
      "severity",
      "priority",
      "status",
      "occurredAt",
      "location",
      "shootDayId",
      "sceneId",
      "resolutionOwner",
      "resolvedAt",
      "timeToResolveMinutes",
    ];
    const lines = [header.join(",")];
    for (const i of incidents) {
      lines.push(
        [
          i.id,
          i.title.replace(/,/g, " "),
          i.category,
          i.severity,
          i.meta.priority ?? "",
          i.meta.status ?? "",
          i.meta.occurredAt ?? "",
          (i.location ?? "").replace(/,/g, " "),
          i.shootDayId ?? "",
          i.meta.linkedSceneId ?? "",
          i.resolutionOwner?.name ?? i.resolutionOwner?.email ?? "",
          i.resolvedAt ?? "",
          i.meta.timeToResolveMinutes ?? "",
        ].join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="incident-log-${projectId}.csv"`,
      },
    });
  }

  return NextResponse.json({
    incidents,
    dashboard: {
      total: incidents.length,
      open: openIncidents.length,
      criticalOpen: openIncidents.filter((i) => i.severity === "CRITICAL").length,
      highOpen: openIncidents.filter((i) => i.severity === "HIGH").length,
      avgResolutionMinutesResolved: Math.round(avgResolutionMinutesResolved),
      impactScore,
      byStatus,
      bySeverity,
    },
    recurringIssues,
    alerts: activeAlerts,
    references: {
      shootDays,
      scenes,
      equipment,
      tasks,
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        title: string;
        description: string;
        severity?: string;
        shootDayId?: string;
        location?: string;
        category?: string;
        resolutionOwnerId?: string | null;
      status?: IncidentStatus;
      priority?: IncidentPriority;
      occurredAt?: string;
      linkedSceneId?: string | null;
      involvedUserIds?: string[];
      involvedNames?: string[];
      equipmentIds?: string[];
      equipmentLabels?: string[];
      mediaUrls?: string[];
      videoUrls?: string[];
      actionSteps?: string[];
      resolutionNotes?: string | null;
      rootCause?: string | null;
      linkedTaskIds?: string[];
      linkedRiskItemIds?: string[];
      linkedContractIds?: string[];
      acknowledgeNow?: boolean;
      }
    | null;

  if (!body?.title || !body.description) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const normalizedMediaUrls = await Promise.all(
    (body.mediaUrls ?? []).map((url) =>
      ensureCloudflareStreamPlaybackUrl(url, { area: "incidents-media", projectId }),
    ),
  );
  const safeMediaUrls = normalizedMediaUrls.filter((url): url is string => Boolean(url));
  const normalizedVideoUrls = await Promise.all(
    (body.videoUrls ?? []).map((url) =>
      ensureCloudflareStreamPlaybackUrl(url, { area: "incidents-video", projectId }),
    ),
  );
  const safeVideoUrls = normalizedVideoUrls.filter((url): url is string => Boolean(url));
  const mediaErr = validateStorageUrlList(safeMediaUrls, "mediaUrls");
  if (mediaErr) return NextResponse.json({ error: mediaErr }, { status: 400 });
  const videoErr = validateStorageUrlList(safeVideoUrls, "videoUrls");
  if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });

  const severity = parseSeverity(body.severity);
  const status = parseStatus(body.status ?? "OPEN");
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const meta: IncidentMeta = {
    status,
    priority: parsePriority(body.priority ?? severity),
    occurredAt: occurredAt.toISOString(),
    acknowledgedAt: body.acknowledgeNow ? new Date().toISOString() : null,
    linkedSceneId: body.linkedSceneId ?? null,
    involvedUserIds: body.involvedUserIds ?? [],
    involvedNames: body.involvedNames ?? [],
    equipmentIds: body.equipmentIds ?? [],
    equipmentLabels: body.equipmentLabels ?? [],
    mediaUrls: safeMediaUrls,
    videoUrls: safeVideoUrls,
    actionSteps: body.actionSteps ?? [],
    resolutionNotes: body.resolutionNotes ?? null,
    rootCause: body.rootCause ?? null,
    linkedTaskIds: body.linkedTaskIds ?? [],
    linkedRiskItemIds: body.linkedRiskItemIds ?? [],
    linkedContractIds: body.linkedContractIds ?? [],
    timeline: [
      {
        at: new Date().toISOString(),
        byUserId: userId,
        action: "CREATED",
        patch: {
          severity,
          status,
          category: parseCategory(body.category),
        },
      },
    ],
  };

  const incident = await prisma.incidentReport.create({
    data: {
      projectId,
      shootDayId: body.shootDayId ?? null,
      title: body.title,
      description: embedMeta(body.description, meta as Record<string, unknown>) ?? body.description,
      severity,
      category: parseCategory(body.category),
      location: body.location ?? null,
      resolutionOwnerId: body.resolutionOwnerId ?? null,
      createdById: userId,
      resolved: status === "RESOLVED" || status === "CLOSED",
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null,
    },
  });

  if (severity === "HIGH" || severity === "CRITICAL") {
    const project = await prisma.originalProject.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (project?.members?.length) {
      await prisma.notification.createMany({
        data: project.members.map((m) => ({
          userId: m.userId,
          type: "PRODUCTION_INCIDENT_ALERT",
          title: `${severity} incident reported`,
          body: `${body.title} requires immediate attention.`,
          metadata: JSON.stringify({
            projectId,
            incidentId: incident.id,
            url: `/creator/projects/${projectId}/production/incident-reporting`,
          }),
        })),
        skipDuplicates: false,
      });
    }
  }

  if (status === "OPEN" || status === "IN_PROGRESS") {
    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title: `Resolve incident: ${body.title}`,
        description: `Incident response task auto-created. Incident ID: ${incident.id}`,
        status: "TODO",
        priority: parsePriority(body.priority ?? severity),
        dueDate: severity === "CRITICAL" ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null,
        assigneeId: body.resolutionOwnerId ?? null,
        shootDayId: body.shootDayId ?? null,
        sceneId: body.linkedSceneId ?? null,
        createdById: userId,
      },
    });
    const parsed = parseEmbeddedMeta<IncidentMeta>(incident.description);
    const existingMeta = parsed.meta ?? {};
    await prisma.incidentReport.update({
      where: { id: incident.id },
      data: {
        description:
          embedMeta(parsed.plain, {
            ...(existingMeta as Record<string, unknown>),
            linkedTaskIds: [...new Set([...(existingMeta.linkedTaskIds ?? []), task.id])],
          }) ?? parsed.plain ?? "",
      },
    });
  }

  return NextResponse.json({ incident }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureIncidentAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        resolved?: boolean;
        severity?: string;
        location?: string | null;
        category?: string;
        resolutionOwnerId?: string | null;
        title?: string;
        description?: string;
        shootDayId?: string | null;
        status?: IncidentStatus;
        priority?: IncidentPriority;
        occurredAt?: string | null;
        linkedSceneId?: string | null;
        involvedUserIds?: string[];
        involvedNames?: string[];
        equipmentIds?: string[];
        equipmentLabels?: string[];
        mediaUrls?: string[];
        videoUrls?: string[];
        actionSteps?: string[];
        resolutionNotes?: string | null;
        rootCause?: string | null;
        acknowledgeNow?: boolean;
        timelineEvent?: { action: string; note?: string | null };
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const normalizedPatchMediaUrls = body.mediaUrls !== undefined
    ? (await Promise.all(
        body.mediaUrls.map((url) =>
          ensureCloudflareStreamPlaybackUrl(url, { area: "incidents-media", projectId }),
        ),
      )).filter((url): url is string => Boolean(url))
    : undefined;
  const normalizedPatchVideoUrls = body.videoUrls !== undefined
    ? (await Promise.all(
        body.videoUrls.map((url) =>
          ensureCloudflareStreamPlaybackUrl(url, { area: "incidents-video", projectId }),
        ),
      )).filter((url): url is string => Boolean(url))
    : undefined;
  if (body.mediaUrls !== undefined) {
    const mediaErr = validateStorageUrlList(normalizedPatchMediaUrls, "mediaUrls");
    if (mediaErr) return NextResponse.json({ error: mediaErr }, { status: 400 });
  }
  if (body.videoUrls !== undefined) {
    const videoErr = validateStorageUrlList(normalizedPatchVideoUrls, "videoUrls");
    if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
  }

  const existing = await prisma.incidentReport.findFirst({ where: { id: body.id, projectId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = parseEmbeddedMeta<IncidentMeta>(existing.description);
  const existingMeta = parsed.meta ?? {};
  const nextStatus = body.status
    ? parseStatus(body.status)
    : body.resolved !== undefined
      ? body.resolved
        ? "RESOLVED"
        : "OPEN"
      : parseStatus(existingMeta.status ?? (existing.resolved ? "RESOLVED" : "OPEN"));
  const severity = body.severity ? parseSeverity(body.severity) : parseSeverity(existing.severity);
  const nextMeta: IncidentMeta = {
    ...existingMeta,
    ...(body.priority !== undefined ? { priority: parsePriority(body.priority) } : {}),
    ...(body.occurredAt !== undefined ? { occurredAt: body.occurredAt } : {}),
    ...(body.linkedSceneId !== undefined ? { linkedSceneId: body.linkedSceneId } : {}),
    ...(body.involvedUserIds !== undefined ? { involvedUserIds: body.involvedUserIds } : {}),
    ...(body.involvedNames !== undefined ? { involvedNames: body.involvedNames } : {}),
    ...(body.equipmentIds !== undefined ? { equipmentIds: body.equipmentIds } : {}),
    ...(body.equipmentLabels !== undefined ? { equipmentLabels: body.equipmentLabels } : {}),
    ...(body.mediaUrls !== undefined ? { mediaUrls: normalizedPatchMediaUrls } : {}),
    ...(body.videoUrls !== undefined ? { videoUrls: normalizedPatchVideoUrls } : {}),
    ...(body.actionSteps !== undefined ? { actionSteps: body.actionSteps } : {}),
    ...(body.resolutionNotes !== undefined ? { resolutionNotes: body.resolutionNotes } : {}),
    ...(body.rootCause !== undefined ? { rootCause: body.rootCause } : {}),
    ...(body.acknowledgeNow ? { acknowledgedAt: new Date().toISOString() } : {}),
    status: nextStatus,
    timeline: [
      ...(existingMeta.timeline ?? []),
      {
        at: new Date().toISOString(),
        byUserId: access.userId,
        action: body.timelineEvent?.action ?? "UPDATED",
        note: body.timelineEvent?.note ?? null,
        patch: {
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.severity !== undefined ? { severity: body.severity } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.resolutionOwnerId !== undefined ? { resolutionOwnerId: body.resolutionOwnerId } : {}),
        },
      },
    ].slice(-200),
  };

  const updated = await prisma.incidentReport.update({
    where: { id: body.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.shootDayId !== undefined ? { shootDayId: body.shootDayId } : {}),
      ...(body.resolved !== undefined
        ? { resolved: body.resolved, resolvedAt: body.resolved ? new Date() : null }
        : {}),
      ...(body.status !== undefined
        ? {
            resolved: body.status === "RESOLVED" || body.status === "CLOSED",
            resolvedAt: body.status === "RESOLVED" || body.status === "CLOSED" ? new Date() : null,
          }
        : {}),
      ...(body.severity !== undefined ? { severity: severity } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.category !== undefined ? { category: parseCategory(body.category) } : {}),
      ...(body.resolutionOwnerId !== undefined ? { resolutionOwnerId: body.resolutionOwnerId } : {}),
      ...((body.description === undefined && body.status === undefined && body.timelineEvent === undefined)
        ? {}
        : {
            description:
              embedMeta(body.description ?? parsed.plain ?? "", nextMeta as Record<string, unknown>) ??
              (body.description ?? parsed.plain ?? ""),
          }),
    },
  });

  return NextResponse.json({ incident: updated });
}

