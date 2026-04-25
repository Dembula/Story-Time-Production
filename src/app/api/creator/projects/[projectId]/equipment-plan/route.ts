import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { parseEmbeddedMeta, embedMeta, type EquipmentMarketMeta } from "@/lib/marketplace-profile-meta";

interface Params {
  params: Promise<{ projectId: string }>;
}

type EquipmentTrackingStatus =
  | "PLANNED"
  | "RESERVED"
  | "DELIVERED"
  | "IN_USE"
  | "IDLE"
  | "ISSUE_REPORTED"
  | "RETURNED";

type EquipmentIssue = {
  id: string;
  type: "DAMAGE" | "MALFUNCTION" | "MISSING" | "LATE_DELIVERY" | "INCORRECT_EQUIPMENT";
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string | null;
  assignedUserId?: string | null;
  loggedByUserId?: string | null;
};

type EquipmentMovementLog = {
  id: string;
  event: "CHECK_IN" | "CHECK_OUT" | "STATUS_CHANGE";
  at: string;
  byUserId?: string | null;
  byUserName?: string | null;
  shootDayId?: string | null;
  condition?: string | null;
  note?: string | null;
};

type EquipmentChecklistEntry = {
  id: string;
  label: string;
  physicallyPresent: boolean;
  photoUrl: string | null;
  note?: string | null;
  checkedAt: string;
  checkedByUserId?: string | null;
};

type EquipmentTrackingMeta = EquipmentMarketMeta & {
  uniqueTag?: string | null;
  ownerProviderName?: string | null;
  assignedCrewUserId?: string | null;
  assignedCrewName?: string | null;
  assignedDepartment?: string | null;
  assignedSceneIds?: string[];
  assignedShootDayIds?: string[];
  currentStatus?: EquipmentTrackingStatus;
  currentStatusUpdatedAt?: string | null;
  movementLogs?: EquipmentMovementLog[];
  issues?: EquipmentIssue[];
  checklistEntries?: EquipmentChecklistEntry[];
};

function parseTrackingMeta(notes: string | null | undefined) {
  const parsed = parseEmbeddedMeta<EquipmentTrackingMeta>(notes);
  const meta = parsed.meta ?? {};
  return { plain: parsed.plain, meta };
}

function nowIso() {
  return new Date().toISOString();
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const reqUrl = _req.nextUrl;
  const category = reqUrl.searchParams.get("category");
  const availability = reqUrl.searchParams.get("availability");
  const specs = reqUrl.searchParams.get("specifications");
  const minCost = Number(reqUrl.searchParams.get("minCost") ?? "");
  const maxCost = Number(reqUrl.searchParams.get("maxCost") ?? "");

  const itemsRaw = await prisma.equipmentPlanItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });
  const items = itemsRaw.map((item) => {
    const parsed = parseTrackingMeta(item.notes);
    const issues = parsed.meta.issues ?? [];
    const openIssues = issues.filter((i) => i.status === "OPEN");
    return {
      ...item,
      notes: parsed.plain,
      tracking: {
        uniqueTag: parsed.meta.uniqueTag ?? null,
        ownerProviderName: parsed.meta.ownerProviderName ?? item.equipmentListing?.companyName ?? null,
        assignedCrewUserId: parsed.meta.assignedCrewUserId ?? null,
        assignedCrewName: parsed.meta.assignedCrewName ?? null,
        assignedDepartment: parsed.meta.assignedDepartment ?? item.department ?? null,
        assignedSceneIds: parsed.meta.assignedSceneIds ?? [],
        assignedShootDayIds: parsed.meta.assignedShootDayIds ?? [],
        currentStatus: parsed.meta.currentStatus ?? "PLANNED",
        currentStatusUpdatedAt: parsed.meta.currentStatusUpdatedAt ?? null,
        movementLogs: parsed.meta.movementLogs ?? [],
        issues,
        openIssueCount: openIssues.length,
        checklistEntries: parsed.meta.checklistEntries ?? [],
      },
      market: {
        dailyRate: parsed.meta.dailyRate ?? null,
        quantityAvailable: parsed.meta.quantityAvailable ?? null,
        availability: parsed.meta.availability ?? null,
        specifications: parsed.meta.specifications ?? null,
      },
    };
  });
  const plannedUnits = items.reduce((s, i) => s + i.quantity, 0);
  const activeUnits = items
    .filter((i) => ["DELIVERED", "IN_USE", "IDLE", "ISSUE_REPORTED"].includes(i.tracking.currentStatus))
    .reduce((s, i) => s + i.quantity, 0);
  const issueUnits = items
    .filter((i) => i.tracking.currentStatus === "ISSUE_REPORTED" || i.tracking.openIssueCount > 0)
    .reduce((s, i) => s + i.quantity, 0);

  const byStatus = items.reduce((acc, item) => {
    const key = item.tracking.currentStatus;
    acc[key] = (acc[key] ?? 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  const byDay = items.reduce((acc, item) => {
    for (const dayId of item.tracking.assignedShootDayIds) {
      if (!acc[dayId]) acc[dayId] = [];
      acc[dayId].push({
        id: item.id,
        category: item.category,
        description: item.description,
        quantity: item.quantity,
        status: item.tracking.currentStatus,
        assignedScenes: item.tracking.assignedSceneIds,
        assignedCrewName: item.tracking.assignedCrewName,
      });
    }
    return acc;
  }, {} as Record<string, Array<{ id: string; category: string; description: string | null; quantity: number; status: string; assignedScenes: string[]; assignedCrewName: string | null }>>);
  const listingCandidates = await prisma.equipmentListing.findMany({
    where: category ? { category: { contains: category, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const marketplace = listingCandidates
    .map((listing) => {
      const parsed = parseEmbeddedMeta<EquipmentMarketMeta>(listing.description);
      const effectiveRate = parsed.meta?.dailyRate ?? null;
      const costMinPass = Number.isFinite(minCost) ? (effectiveRate ?? 0) >= minCost : true;
      const costMaxPass = Number.isFinite(maxCost) ? (effectiveRate ?? 0) <= maxCost : true;
      if (!costMinPass || !costMaxPass) return null;
      if (availability && !(parsed.meta?.availability ?? "").toLowerCase().includes(availability.toLowerCase())) return null;
      if (specs && !(parsed.meta?.specifications ?? "").toLowerCase().includes(specs.toLowerCase())) return null;
      return {
        id: listing.id,
        name: parsed.plain || listing.companyName,
        category: listing.category,
        specifications: parsed.meta?.specifications ?? null,
        dailyRate: effectiveRate,
        quantityAvailable: parsed.meta?.quantityAvailable ?? null,
        availability: parsed.meta?.availability ?? null,
        location: listing.location ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return NextResponse.json({
    items,
    marketplace,
    summary: {
      plannedUnits,
      activeUnits,
      issueUnits,
      byStatus,
    },
    byDay,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        department?: string | null;
        category: string;
        description?: string | null;
        quantity?: number;
        notes?: string | null;
        equipmentListingId?: string | null;
        dailyRate?: number | null;
        availability?: string | null;
        specifications?: string | null;
        quantityAvailable?: number | null;
      }
    | null;

  if (!body?.category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const item = await prisma.equipmentPlanItem.create({
    data: {
      projectId,
      department: body.department ?? null,
      category: body.category,
      description: body.description ?? null,
      quantity: body.quantity ?? 1,
      notes: embedMeta(body.notes ?? null, {
        dailyRate: body.dailyRate ?? null,
        availability: body.availability ?? null,
        specifications: body.specifications ?? null,
        quantityAvailable: body.quantityAvailable ?? null,
      }),
      equipmentListingId: body.equipmentListingId ?? null,
    },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        action?:
          | "UPDATE_ITEM"
          | "SET_STATUS"
          | "CHECK_IN"
          | "CHECK_OUT"
          | "LOG_ISSUE"
          | "RESOLVE_ISSUE"
          | "UPSERT_CHECKLIST"
          | "REMOVE_CHECKLIST";
        department?: string | null;
        category?: string;
        description?: string | null;
        quantity?: number;
        notes?: string | null;
        equipmentListingId?: string | null;
        dailyRate?: number | null;
        availability?: string | null;
        specifications?: string | null;
        quantityAvailable?: number | null;
        uniqueTag?: string | null;
        ownerProviderName?: string | null;
        assignedCrewUserId?: string | null;
        assignedCrewName?: string | null;
        assignedDepartment?: string | null;
        assignedSceneIds?: string[];
        assignedShootDayIds?: string[];
        status?: EquipmentTrackingStatus;
        movementNote?: string | null;
        movementCondition?: string | null;
        shootDayId?: string | null;
        issue?: {
          type: "DAMAGE" | "MALFUNCTION" | "MISSING" | "LATE_DELIVERY" | "INCORRECT_EQUIPMENT";
          description: string;
          severity: "LOW" | "MEDIUM" | "HIGH";
          assignedUserId?: string | null;
        };
        issueId?: string;
        checklistEntry?: {
          id?: string;
          label: string;
          physicallyPresent: boolean;
          photoUrl?: string | null;
          note?: string | null;
        };
        checklistEntryId?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.equipmentPlanItem.findFirst({
    where: { id: body.id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const accessUserId = access.userId ?? null;
  const action = body.action ?? "UPDATE_ITEM";
  const parsedExisting = parseTrackingMeta(existing.notes);
  const nextMeta: EquipmentTrackingMeta = { ...parsedExisting.meta };
  if (body.uniqueTag !== undefined) nextMeta.uniqueTag = body.uniqueTag;
  if (body.ownerProviderName !== undefined) nextMeta.ownerProviderName = body.ownerProviderName;
  if (body.assignedCrewUserId !== undefined) nextMeta.assignedCrewUserId = body.assignedCrewUserId;
  if (body.assignedCrewName !== undefined) nextMeta.assignedCrewName = body.assignedCrewName;
  if (body.assignedDepartment !== undefined) nextMeta.assignedDepartment = body.assignedDepartment;
  if (Array.isArray(body.assignedSceneIds)) nextMeta.assignedSceneIds = body.assignedSceneIds.filter(Boolean);
  if (Array.isArray(body.assignedShootDayIds)) nextMeta.assignedShootDayIds = body.assignedShootDayIds.filter(Boolean);

  const pushMovement = (event: EquipmentMovementLog["event"], note?: string | null, condition?: string | null) => {
    const list = nextMeta.movementLogs ?? [];
    list.push({
      id: `eqm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      at: nowIso(),
      byUserId: accessUserId,
      shootDayId: body.shootDayId ?? null,
      condition: condition ?? null,
      note: note ?? null,
    });
    nextMeta.movementLogs = list.slice(-200);
  };
  const setStatus = (status: EquipmentTrackingStatus) => {
    nextMeta.currentStatus = status;
    nextMeta.currentStatusUpdatedAt = nowIso();
  };

  if (action === "SET_STATUS" && body.status) {
    setStatus(body.status);
    pushMovement("STATUS_CHANGE", body.movementNote ?? null, body.movementCondition ?? null);
  } else if (action === "CHECK_IN") {
    setStatus("DELIVERED");
    pushMovement("CHECK_IN", body.movementNote ?? "Checked in on set", body.movementCondition ?? null);
  } else if (action === "CHECK_OUT") {
    setStatus("RETURNED");
    pushMovement("CHECK_OUT", body.movementNote ?? "Checked out / returned", body.movementCondition ?? null);
  } else if (action === "LOG_ISSUE" && body.issue) {
    const issues = nextMeta.issues ?? [];
    issues.push({
      id: `eqi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: body.issue.type,
      description: body.issue.description,
      severity: body.issue.severity,
      status: "OPEN",
      createdAt: nowIso(),
      assignedUserId: body.issue.assignedUserId ?? null,
      loggedByUserId: accessUserId,
    });
    nextMeta.issues = issues.slice(-200);
    setStatus("ISSUE_REPORTED");
    pushMovement("STATUS_CHANGE", `Issue logged: ${body.issue.type}`, null);
  } else if (action === "RESOLVE_ISSUE" && body.issueId) {
    const issues = nextMeta.issues ?? [];
    nextMeta.issues = issues.map((i) =>
      i.id === body.issueId ? { ...i, status: "RESOLVED", resolvedAt: nowIso() } : i,
    );
    const stillOpen = (nextMeta.issues ?? []).some((i) => i.status === "OPEN");
    if (!stillOpen && nextMeta.currentStatus === "ISSUE_REPORTED") {
      setStatus("IDLE");
    }
    pushMovement("STATUS_CHANGE", `Issue resolved: ${body.issueId}`, null);
  } else if (action === "UPSERT_CHECKLIST" && body.checklistEntry) {
    const entries = nextMeta.checklistEntries ?? [];
    const nextEntry: EquipmentChecklistEntry = {
      id: body.checklistEntry.id ?? `eqc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: body.checklistEntry.label.trim() || "Physical check",
      physicallyPresent: Boolean(body.checklistEntry.physicallyPresent),
      photoUrl: body.checklistEntry.photoUrl ?? null,
      note: body.checklistEntry.note ?? null,
      checkedAt: nowIso(),
      checkedByUserId: accessUserId,
    };
    const idx = entries.findIndex((e) => e.id === nextEntry.id);
    if (idx >= 0) entries[idx] = nextEntry;
    else entries.push(nextEntry);
    nextMeta.checklistEntries = entries.slice(-200);
    pushMovement(
      "STATUS_CHANGE",
      `Checklist ${nextEntry.physicallyPresent ? "confirmed present" : "flagged missing"}: ${nextEntry.label}`,
      null,
    );
  } else if (action === "REMOVE_CHECKLIST" && body.checklistEntryId) {
    const entries = nextMeta.checklistEntries ?? [];
    nextMeta.checklistEntries = entries.filter((e) => e.id !== body.checklistEntryId);
    pushMovement("STATUS_CHANGE", `Checklist removed: ${body.checklistEntryId}`, null);
  }

  const item = await prisma.equipmentPlanItem.update({
    where: { id: body.id },
    data: {
      ...(body.department !== undefined ? { department: body.department } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      ...(body.notes !== undefined ||
      body.dailyRate !== undefined ||
      body.availability !== undefined ||
      body.specifications !== undefined ||
      body.quantityAvailable !== undefined ||
      body.uniqueTag !== undefined ||
      body.ownerProviderName !== undefined ||
      body.assignedCrewUserId !== undefined ||
      body.assignedCrewName !== undefined ||
      body.assignedDepartment !== undefined ||
      body.assignedSceneIds !== undefined ||
      body.assignedShootDayIds !== undefined ||
      body.status !== undefined ||
      action !== "UPDATE_ITEM" ||
      body.issue !== undefined ||
      body.issueId !== undefined ||
      body.checklistEntry !== undefined ||
      body.checklistEntryId !== undefined
        ? {
            notes: embedMeta(body.notes ?? parsedExisting.plain, {
              ...nextMeta,
              dailyRate: body.dailyRate ?? nextMeta.dailyRate ?? null,
              availability: body.availability ?? nextMeta.availability ?? null,
              specifications: body.specifications ?? nextMeta.specifications ?? null,
              quantityAvailable: body.quantityAvailable ?? nextMeta.quantityAvailable ?? null,
            } as EquipmentTrackingMeta),
          }
        : {}),
      ...(body.equipmentListingId !== undefined
        ? { equipmentListingId: body.equipmentListingId }
        : {}),
    },
    include: {
      equipmentListing: { select: { id: true, companyName: true, category: true } },
    },
  });

  if (action === "LOG_ISSUE" && body.issue) {
    const members = await prisma.originalMember.findMany({
      where: { projectId },
      select: { userId: true },
      take: 80,
    });
    const recipientIds = [...new Set(members.map((m) => m.userId).filter((id) => id && id !== accessUserId))];
    if (recipientIds.length > 0) {
      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          title: "Equipment issue reported",
          body: `${item.category}: ${body.issue?.type.replaceAll("_", " ")} (${body.issue?.severity})`,
          type: "EQUIPMENT_ISSUE",
          metadata: JSON.stringify({
            projectId,
            equipmentPlanItemId: item.id,
            issueType: body.issue?.type,
            severity: body.issue?.severity,
          }),
        })),
      });
    }
  }

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.equipmentPlanItem.findFirst({
    where: { id, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.equipmentPlanItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
