import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  composeRiskItemDescription,
  composeRiskPlanSummary,
  defaultRiskChecklistTemplates,
  parseRiskItemDescription,
  parseRiskPlanSummary,
  type InsurancePolicyMeta,
  type RiskCategory,
  type RiskItemMeta,
  type RiskLevel,
} from "@/lib/risk-insurance-db";

async function ensureRiskAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function levelValue(level: RiskLevel) {
  if (level === "HIGH") return 3;
  if (level === "MEDIUM") return 2;
  return 1;
}

function hasPolicyCoverage(meta: RiskItemMeta, policies: InsurancePolicyMeta[]): boolean {
  const linked = new Set(meta.linkedPolicyIds ?? []);
  if (linked.size === 0) return false;
  return policies.some((p) => linked.has(p.id));
}

async function ensurePlan(projectId: string) {
  let plan = await prisma.riskPlan.findUnique({
    where: { projectId },
    include: { items: true },
  });
  if (!plan) {
    plan = await prisma.riskPlan.create({
      data: {
        projectId,
        summary: composeRiskPlanSummary(null, {
          policies: [],
          checklists: defaultRiskChecklistTemplates(),
          legalDisclaimer:
            "Risk and insurance outputs are operational guidance only and should be reviewed with qualified legal and insurance professionals.",
          readyToShootOverride: false,
          safetyOfficerUserId: null,
          producerUserId: null,
          departmentHeads: [],
        }),
      },
      include: { items: true },
    });
  } else {
    const parsedSummary = parseRiskPlanSummary(plan.summary);
    if (!parsedSummary.meta.checklists || parsedSummary.meta.checklists.length === 0) {
      const summary = composeRiskPlanSummary(parsedSummary.plain, {
        ...parsedSummary.meta,
        checklists: defaultRiskChecklistTemplates(),
      });
      plan = await prisma.riskPlan.update({
        where: { id: plan.id },
        data: { summary },
        include: { items: true },
      });
    }
  }
  return plan;
}

async function autoDetectRisks(projectId: string, planId: string) {
  const [existingItems, scenes, stunts, vehicles, extras, shootDays, locations, equipment, unsignedContracts] =
    await Promise.all([
      prisma.riskChecklistItem.findMany({
        where: { planId },
      }),
      prisma.projectScene.findMany({
        where: { projectId },
        select: { id: true, number: true, heading: true, breakdownSfxs: { select: { id: true } } },
      }),
      prisma.breakdownStunt.findMany({
        where: { projectId },
        select: { id: true, description: true, sceneId: true },
      }),
      prisma.breakdownVehicle.findMany({
        where: { projectId },
        select: { id: true, description: true, sceneId: true },
      }),
      prisma.breakdownExtra.findMany({
        where: { projectId },
        select: { id: true, description: true, quantity: true, sceneId: true },
      }),
      prisma.shootDay.findMany({
        where: { projectId },
        include: { scenes: true },
      }),
      prisma.breakdownLocation.findMany({
        where: { projectId },
        include: { locationListing: true },
      }),
      prisma.equipmentPlanItem.findMany({
        where: { projectId },
        include: { equipmentListing: true },
      }),
      prisma.projectContract.count({
        where: { projectId, NOT: { status: { in: ["SIGNED", "EXECUTED", "CLOSED"] } } },
      }),
    ]);

  const existingAutoKeys = new Set(
    existingItems
      .map((item) => parseRiskItemDescription(item.description).meta.autoKey)
      .filter((v): v is string => Boolean(v)),
  );

  const candidates: Array<{
    autoKey: string;
    category: RiskCategory;
    description: string;
    meta: RiskItemMeta;
  }> = [];

  stunts.forEach((stunt) => {
    candidates.push({
      autoKey: `stunt:${stunt.id}`,
      category: "STUNTS",
      description: stunt.description || "Stunt activity identified from script breakdown.",
      meta: {
        title: "Stunt sequence risk",
        severity: "HIGH",
        likelihood: "MEDIUM",
        mitigationPlan: null,
        autoDetected: true,
        autoKey: `stunt:${stunt.id}`,
        linkedSceneIds: stunt.sceneId ? [stunt.sceneId] : [],
      },
    });
  });
  vehicles.forEach((vehicle) => {
    candidates.push({
      autoKey: `vehicle:${vehicle.id}`,
      category: "VEHICLES",
      description: vehicle.description || "Vehicle usage risk identified.",
      meta: {
        title: "Vehicle operation risk",
        severity: "HIGH",
        likelihood: "MEDIUM",
        mitigationPlan: null,
        autoDetected: true,
        autoKey: `vehicle:${vehicle.id}`,
        linkedSceneIds: vehicle.sceneId ? [vehicle.sceneId] : [],
      },
    });
  });
  extras
    .filter((extra) => (extra.quantity ?? 0) >= 20)
    .forEach((extra) => {
      candidates.push({
        autoKey: `crowd:${extra.id}`,
        category: "CROWD_CONTROL",
        description: `${extra.description} (${extra.quantity} extras)`,
        meta: {
          title: "Crowd control required",
          severity: "MEDIUM",
          likelihood: "HIGH",
          mitigationPlan: null,
          autoDetected: true,
          autoKey: `crowd:${extra.id}`,
          linkedSceneIds: extra.sceneId ? [extra.sceneId] : [],
        },
      });
    });
  scenes
    .filter((scene) => (scene.heading ?? "").toUpperCase().includes("NIGHT"))
    .forEach((scene) => {
      candidates.push({
        autoKey: `night-scene:${scene.id}`,
        category: "WEATHER",
        description: `Night shoot conditions for Scene ${scene.number}`,
        meta: {
          title: "Night shoot risk",
          severity: "MEDIUM",
          likelihood: "MEDIUM",
          mitigationPlan: null,
          autoDetected: true,
          autoKey: `night-scene:${scene.id}`,
          linkedSceneIds: [scene.id],
        },
      });
    });
  shootDays.forEach((day) => {
    const call = day.callTime ? Number(day.callTime.split(":")[0]) * 60 + Number(day.callTime.split(":")[1]) : null;
    const wrap = day.wrapTime ? Number(day.wrapTime.split(":")[0]) * 60 + Number(day.wrapTime.split(":")[1]) : null;
    const longDay = call != null && wrap != null && wrap - call >= 12 * 60;
    const heavySceneCount = day.scenes.length >= 8;
    if (longDay || heavySceneCount) {
      candidates.push({
        autoKey: `schedule-load:${day.id}`,
        category: "SAFETY",
        description: `High workload shoot day (${day.scenes.length} scenes).`,
        meta: {
          title: "Long/high-load shoot day",
          severity: "HIGH",
          likelihood: "MEDIUM",
          mitigationPlan: null,
          autoDetected: true,
          autoKey: `schedule-load:${day.id}`,
          linkedShootDayIds: [day.id],
        },
      });
    }
  });
  locations.forEach((location) => {
    const text = `${location.name} ${location.description ?? ""} ${location.locationListing?.rules ?? ""}`.toLowerCase();
    if (
      text.includes("permit") ||
      text.includes("hazard") ||
      text.includes("water") ||
      text.includes("highway") ||
      text.includes("mountain") ||
      text.includes("remote")
    ) {
      candidates.push({
        autoKey: `location:${location.id}`,
        category: "LOCATIONS",
        description: `${location.name} may require permits/safety controls.`,
        meta: {
          title: "Location compliance risk",
          severity: "HIGH",
          likelihood: "MEDIUM",
          mitigationPlan: null,
          autoDetected: true,
          autoKey: `location:${location.id}`,
          linkedResourceType: "LOCATION",
          linkedResourceIds: [location.id],
        },
      });
    }
  });
  equipment.forEach((item) => {
    const txt = `${item.category} ${item.description ?? ""}`.toLowerCase();
    if (
      txt.includes("crane") ||
      txt.includes("drone") ||
      txt.includes("generator") ||
      txt.includes("rig") ||
      txt.includes("heavy")
    ) {
      candidates.push({
        autoKey: `equipment:${item.id}`,
        category: "EQUIPMENT",
        description: `${item.category} may require specialized handling.`,
        meta: {
          title: "Equipment handling risk",
          severity: "MEDIUM",
          likelihood: "MEDIUM",
          mitigationPlan: null,
          autoDetected: true,
          autoKey: `equipment:${item.id}`,
          linkedResourceType: "EQUIPMENT",
          linkedResourceIds: [item.id],
        },
      });
    }
  });
  if (unsignedContracts > 0) {
    candidates.push({
      autoKey: "legal:unsigned-contracts",
      category: "LEGAL",
      description: `${unsignedContracts} contract(s) are not fully signed.`,
      meta: {
        title: "Unsigned legal agreements",
        severity: "HIGH",
        likelihood: "HIGH",
        mitigationPlan: null,
        autoDetected: true,
        autoKey: "legal:unsigned-contracts",
        linkedResourceType: "CONTRACT",
      },
    });
  }

  const createOps: Prisma.PrismaPromise<unknown>[] = [];
  for (const candidate of candidates) {
    if (existingAutoKeys.has(candidate.autoKey)) continue;
    createOps.push(
      prisma.riskChecklistItem.create({
        data: {
          planId,
          category: candidate.category,
          description: composeRiskItemDescription(candidate.description, candidate.meta),
          status: "OPEN",
        },
      }),
    );
  }
  if (createOps.length > 0) {
    await prisma.$transaction(createOps);
  }
}

async function upsertMitigationTask(projectId: string, riskItem: {
  id: string;
  category: string;
  description: string;
  ownerId: string | null;
}, plainDescription: string | null, meta: RiskItemMeta, createdById: string) {
  if (!meta.mitigationPlan || !meta.mitigationPlan.trim()) return;
  const taskMarker = `[riskItemId:${riskItem.id}]`;
  const existingTask = await prisma.projectTask.findFirst({
    where: { projectId, description: { contains: taskMarker } },
  });
  const taskDescription = `${plainDescription ?? riskItem.description}\nMitigation: ${meta.mitigationPlan}\n${taskMarker}`;
  if (existingTask) {
    await prisma.projectTask.update({
      where: { id: existingTask.id },
      data: {
        title: `Mitigate ${riskItem.category} risk`,
        description: taskDescription,
        assigneeId: riskItem.ownerId ?? null,
        department: riskItem.category,
        priority: meta.severity === "HIGH" ? "HIGH" : meta.severity === "MEDIUM" ? "MEDIUM" : "LOW",
        status: existingTask.status === "DONE" ? "IN_PROGRESS" : existingTask.status,
      },
    });
    return;
  }
  await prisma.projectTask.create({
    data: {
      projectId,
      title: `Mitigate ${riskItem.category} risk`,
      description: taskDescription,
      assigneeId: riskItem.ownerId ?? null,
      department: riskItem.category,
      priority: meta.severity === "HIGH" ? "HIGH" : meta.severity === "MEDIUM" ? "MEDIUM" : "LOW",
      status: "TODO",
      createdById,
    },
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureRiskAccess(projectId);
  if (access.error) return access.error;

  const ensuredPlan = await ensurePlan(projectId);
  await autoDetectRisks(projectId, ensuredPlan.id);
  const plan = await prisma.riskPlan.findUnique({
    where: { projectId },
    include: { items: { include: { owner: { select: { id: true, name: true, email: true } } } } },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan missing" }, { status: 404 });
  }

  const parsedPlan = parseRiskPlanSummary(plan.summary);
  const policies = parsedPlan.meta.policies ?? [];
  const items = plan.items.map((item) => {
    const parsed = parseRiskItemDescription(item.description);
    const severity = parsed.meta.severity ?? "MEDIUM";
    const likelihood = parsed.meta.likelihood ?? "MEDIUM";
    const riskScore = levelValue(severity) * levelValue(likelihood);
    return {
      id: item.id,
      category: item.category,
      title: parsed.meta.title ?? parsed.plain ?? item.description,
      description: parsed.plain ?? item.description,
      severity,
      likelihood,
      riskScore,
      ownerId: item.ownerId,
      owner: item.owner,
      mitigationPlan: parsed.meta.mitigationPlan ?? null,
      assignedRole: parsed.meta.assignedRole ?? null,
      dueDate: parsed.meta.dueDate ?? null,
      linkedPolicyIds: parsed.meta.linkedPolicyIds ?? [],
      linkedPolicyCount: (parsed.meta.linkedPolicyIds ?? []).length,
      linkedSceneIds: parsed.meta.linkedSceneIds ?? [],
      linkedShootDayIds: parsed.meta.linkedShootDayIds ?? [],
      linkedResourceType: parsed.meta.linkedResourceType ?? null,
      autoDetected: !!parsed.meta.autoDetected,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  const byCategory = Object.entries(
    items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = { total: 0, unresolved: 0, high: 0 };
      acc[item.category].total += 1;
      if (item.status !== "DONE") acc[item.category].unresolved += 1;
      if (item.severity === "HIGH") acc[item.category].high += 1;
      return acc;
    }, {} as Record<string, { total: number; unresolved: number; high: number }>),
  ).map(([category, stats]) => ({ category, ...stats }));

  const highUnresolved = items.filter((i) => i.severity === "HIGH" && i.status !== "DONE");
  const unresolvedWithoutMitigation = items.filter(
    (i) => i.status !== "DONE" && !(i.mitigationPlan && i.mitigationPlan.trim().length > 3),
  );
  const unresolvedWithoutCoverage = items.filter(
    (i) => i.status !== "DONE" && !hasPolicyCoverage({ linkedPolicyIds: i.linkedPolicyIds }, policies),
  );
  const legalUnresolved = items.filter((i) => i.category === "LEGAL" && i.status !== "DONE");
  const checklistOpenCount = (parsedPlan.meta.checklists ?? []).filter((item) => !item.checked).length;
  const readinessBlockedReasons: string[] = [];
  if (highUnresolved.length > 0) readinessBlockedReasons.push("High-risk items unresolved");
  if (unresolvedWithoutMitigation.length > 0) readinessBlockedReasons.push("Mitigation plans are missing on unresolved risks");
  if (unresolvedWithoutCoverage.length > 0) readinessBlockedReasons.push("Missing insurance coverage on unresolved risks");
  if (legalUnresolved.length > 0) readinessBlockedReasons.push("Legal risks unresolved (contracts/waivers incomplete)");
  if (checklistOpenCount > 0) readinessBlockedReasons.push("Safety/compliance checklist incomplete");
  const readyToShoot = readinessBlockedReasons.length === 0 || !!parsedPlan.meta.readyToShootOverride;

  const alerts = [
    ...highUnresolved.slice(0, 8).map((item) => ({
      type: "HIGH_UNRESOLVED",
      severity: "HIGH",
      message: `${item.title} remains unresolved.`,
      riskId: item.id,
    })),
    ...unresolvedWithoutCoverage.slice(0, 8).map((item) => ({
      type: "MISSING_INSURANCE",
      severity: "HIGH",
      message: `${item.title} has no linked insurance policy.`,
      riskId: item.id,
    })),
  ];

  const schedule = await prisma.shootDay.findMany({
    where: { projectId },
    include: { scenes: true },
    orderBy: { date: "asc" },
  });
  const riskyDays = schedule
    .filter((d) => {
      const call = d.callTime ? Number(d.callTime.split(":")[0]) * 60 + Number(d.callTime.split(":")[1]) : null;
      const wrap = d.wrapTime ? Number(d.wrapTime.split(":")[0]) * 60 + Number(d.wrapTime.split(":")[1]) : null;
      const longDay = call != null && wrap != null && wrap - call >= 12 * 60;
      return longDay || d.scenes.length >= 8;
    })
    .map((d) => ({
      id: d.id,
      date: d.date,
      sceneCount: d.scenes.length,
      callTime: d.callTime,
      wrapTime: d.wrapTime,
    }));

  return NextResponse.json({
    plan: {
      id: plan.id,
      summary: parsedPlan.plain,
      items,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    },
    insurance: {
      policies,
    },
    checklists: parsedPlan.meta.checklists ?? [],
    roles: {
      safetyOfficerUserId: parsedPlan.meta.safetyOfficerUserId ?? null,
      producerUserId: parsedPlan.meta.producerUserId ?? null,
      departmentHeads: parsedPlan.meta.departmentHeads ?? [],
    },
    dashboard: {
      counts: {
        total: items.length,
        unresolved: items.filter((i) => i.status !== "DONE").length,
        resolved: items.filter((i) => i.status === "DONE").length,
        highUnresolved: highUnresolved.length,
      },
      byCategory,
      riskyDays,
      readyToShoot,
      blockedReasons: readinessBlockedReasons,
      alerts,
    },
    legalDisclaimer: parsedPlan.meta.legalDisclaimer,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureRiskAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        action?:
          | "UPSERT_ITEM"
          | "UPDATE_ITEM_STATUS"
          | "ADD_POLICY"
          | "UPDATE_POLICY"
          | "TOGGLE_CHECKLIST"
          | "UPDATE_PLAN_SETTINGS";
        item?: {
          id?: string;
          category: RiskCategory;
          title?: string;
          description?: string;
          severity?: RiskLevel;
          likelihood?: RiskLevel;
          ownerId?: string | null;
          mitigationPlan?: string | null;
          assignedRole?: string | null;
          dueDate?: string | null;
          linkedPolicyIds?: string[];
          linkedSceneIds?: string[];
          linkedShootDayIds?: string[];
          linkedResourceIds?: string[];
          linkedResourceType?: "LOCATION" | "EQUIPMENT" | "CONTRACT" | "SCENE" | "OTHER";
          status?: string;
        };
        policy?: {
          id?: string;
          providerName: string;
          coverageType: string;
          coverageAmount: number;
          validFrom?: string | null;
          validTo?: string | null;
          linkedRiskIds?: string[];
          notes?: string | null;
        };
        checklist?: { id: string; checked: boolean; note?: string | null };
        settings?: {
          summary?: string | null;
          safetyOfficerUserId?: string | null;
          producerUserId?: string | null;
          legalDisclaimer?: string | null;
          readyToShootOverride?: boolean;
        };
        summary?: string | null;
        items?: {
          id?: string;
          category: string;
          description: string;
          ownerId?: string | null;
          status?: string;
        }[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let plan = await ensurePlan(projectId);
  const parsedPlan = parseRiskPlanSummary(plan.summary);
  let planPlain = body.summary !== undefined ? body.summary : parsedPlan.plain;
  let planMeta = parsedPlan.meta;

  if (body.action === "ADD_POLICY" && body.policy?.providerName && body.policy?.coverageType) {
    const newPolicy: InsurancePolicyMeta = {
      id: uid("policy"),
      providerName: body.policy.providerName,
      coverageType: body.policy.coverageType,
      coverageAmount: Number(body.policy.coverageAmount || 0),
      validFrom: body.policy.validFrom ?? null,
      validTo: body.policy.validTo ?? null,
      linkedRiskIds: body.policy.linkedRiskIds ?? [],
      notes: body.policy.notes ?? null,
    };
    planMeta = { ...planMeta, policies: [newPolicy, ...(planMeta.policies ?? [])] };
  } else if (body.action === "UPDATE_POLICY" && body.policy?.id) {
    planMeta = {
      ...planMeta,
      policies: (planMeta.policies ?? []).map((policy) =>
        policy.id === body.policy!.id
          ? {
              ...policy,
              ...body.policy,
              coverageAmount: body.policy?.coverageAmount !== undefined ? Number(body.policy.coverageAmount) : policy.coverageAmount,
            }
          : policy,
      ),
    };
  } else if (body.action === "TOGGLE_CHECKLIST" && body.checklist?.id) {
    planMeta = {
      ...planMeta,
      checklists: (planMeta.checklists ?? []).map((item) =>
        item.id === body.checklist!.id ? { ...item, checked: body.checklist!.checked, note: body.checklist!.note ?? item.note } : item,
      ),
    };
  } else if (body.action === "UPDATE_PLAN_SETTINGS") {
    planMeta = {
      ...planMeta,
      safetyOfficerUserId:
        body.settings?.safetyOfficerUserId !== undefined ? body.settings.safetyOfficerUserId : planMeta.safetyOfficerUserId,
      producerUserId:
        body.settings?.producerUserId !== undefined ? body.settings.producerUserId : planMeta.producerUserId,
      legalDisclaimer:
        body.settings?.legalDisclaimer !== undefined ? body.settings.legalDisclaimer : planMeta.legalDisclaimer,
      readyToShootOverride:
        body.settings?.readyToShootOverride !== undefined
          ? body.settings.readyToShootOverride
          : planMeta.readyToShootOverride,
    };
    if (body.settings?.summary !== undefined) {
      planPlain = body.settings.summary;
    }
  }

  const tx: Prisma.PrismaPromise<unknown>[] = [];
  if (body.action === "UPSERT_ITEM" && body.item) {
    const item = body.item;
    const meta: RiskItemMeta = {
      title: item.title ?? null,
      severity: item.severity ?? "MEDIUM",
      likelihood: item.likelihood ?? "MEDIUM",
      mitigationPlan: item.mitigationPlan ?? null,
      assignedRole: item.assignedRole ?? null,
      dueDate: item.dueDate ?? null,
      linkedPolicyIds: item.linkedPolicyIds ?? [],
      linkedSceneIds: item.linkedSceneIds ?? [],
      linkedShootDayIds: item.linkedShootDayIds ?? [],
      linkedResourceIds: item.linkedResourceIds ?? [],
      linkedResourceType: item.linkedResourceType ?? "OTHER",
    };
    const description = composeRiskItemDescription(item.description ?? item.title ?? "Risk item", meta);
    if (item.id) {
      tx.push(
        prisma.riskChecklistItem.update({
          where: { id: item.id },
          data: {
            category: item.category,
            description,
            ownerId: item.ownerId ?? null,
            ...(item.status ? { status: item.status } : {}),
          },
        }),
      );
    } else {
      tx.push(
        prisma.riskChecklistItem.create({
          data: {
            planId: plan.id,
            category: item.category,
            description,
            ownerId: item.ownerId ?? null,
            status: item.status ?? "OPEN",
          },
        }),
      );
    }
  } else if (body.action === "UPDATE_ITEM_STATUS" && body.item?.id) {
    const existingItem = await prisma.riskChecklistItem.findUnique({
      where: { id: body.item.id },
    });
    if (!existingItem) {
      return NextResponse.json({ error: "Risk item not found" }, { status: 404 });
    }
    const parsed = parseRiskItemDescription(existingItem.description);
    if (body.item.status === "DONE" && !(parsed.meta.mitigationPlan && parsed.meta.mitigationPlan.trim().length > 3)) {
      return NextResponse.json(
        { error: "Cannot resolve risk without a mitigation plan." },
        { status: 409 },
      );
    }
    tx.push(
      prisma.riskChecklistItem.update({
        where: { id: body.item.id },
        data: {
          status: body.item.status ?? existingItem.status,
          ownerId: body.item.ownerId ?? existingItem.ownerId,
          description:
            body.item.mitigationPlan !== undefined
              ? composeRiskItemDescription(parsed.plain, {
                  ...parsed.meta,
                  mitigationPlan: body.item.mitigationPlan,
                })
              : existingItem.description,
        },
      }),
    );
  }

  if (body.items && !body.action) {
    for (const item of body.items) {
      if (item.id) {
        tx.push(
          prisma.riskChecklistItem.update({
            where: { id: item.id },
            data: {
              category: item.category,
              description: item.description,
              ownerId: item.ownerId ?? null,
              ...(item.status ? { status: item.status } : {}),
            },
          }),
        );
      } else {
        tx.push(
          prisma.riskChecklistItem.create({
            data: {
              planId: plan.id,
              category: item.category,
              description: composeRiskItemDescription(item.description, {
                severity: "MEDIUM",
                likelihood: "MEDIUM",
              }),
              ownerId: item.ownerId ?? null,
              status: item.status ?? "OPEN",
            },
          }),
        );
      }
    }
  }

  await prisma.riskPlan.update({
    where: { id: plan.id },
    data: {
      summary: composeRiskPlanSummary(planPlain, planMeta),
    },
  });

  if (tx.length > 0) {
    await prisma.$transaction(tx);
  }

  const updated = await prisma.riskPlan.findUnique({
    where: { id: plan.id },
    include: { items: true },
  });
  if (!updated) {
    return NextResponse.json({ error: "Risk plan not found after update" }, { status: 404 });
  }

  if (body.action === "UPSERT_ITEM" && body.item) {
    const target =
      body.item.id
        ? updated.items.find((i) => i.id === body.item?.id)
        : updated.items[updated.items.length - 1];
    if (target) {
      const parsed = parseRiskItemDescription(target.description);
      await upsertMitigationTask(projectId, target, parsed.plain, parsed.meta, userId);
    }
  }
  if (body.action === "UPDATE_ITEM_STATUS" && body.item?.id) {
    const target = updated.items.find((i) => i.id === body.item?.id);
    if (target) {
      const parsed = parseRiskItemDescription(target.description);
      await upsertMitigationTask(projectId, target, parsed.plain, parsed.meta, userId);
    }
  }

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId,
      type: "RISK_PLAN_UPDATED",
      message: body.action ? `Risk action: ${body.action}` : "Risk checklist updated.",
      metadata: JSON.stringify({ action: body.action ?? "LEGACY_PATCH" }),
    },
  });

  const reloaded = await prisma.riskPlan.findUnique({
    where: { projectId },
    include: { items: true },
  });
  return NextResponse.json({ plan: reloaded });
}

