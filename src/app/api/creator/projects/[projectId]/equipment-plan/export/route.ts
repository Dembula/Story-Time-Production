import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

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

type EquipmentTrackingMeta = {
  uniqueTag?: string | null;
  ownerProviderName?: string | null;
  assignedCrewUserId?: string | null;
  assignedCrewName?: string | null;
  assignedDepartment?: string | null;
  assignedSceneIds?: string[];
  assignedShootDayIds?: string[];
  currentStatus?: string;
  currentStatusUpdatedAt?: string | null;
  movementLogs?: EquipmentMovementLog[];
  issues?: EquipmentIssue[];
  checklistEntries?: Array<{
    id: string;
    label: string;
    physicallyPresent: boolean;
    photoUrl: string | null;
    note?: string | null;
    checkedAt: string;
    checkedByUserId?: string | null;
  }>;
  dailyRate?: number | null;
  quantityAvailable?: number | null;
  availability?: string | null;
  specifications?: string | null;
};

function escCsv(value: unknown): string {
  const text = `${value ?? ""}`;
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  const [items, scenes, shootDays] = await Promise.all([
    prisma.equipmentPlanItem.findMany({
      where: { projectId },
      include: { equipmentListing: { select: { id: true, companyName: true, category: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      select: { id: true, date: true, status: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const sceneMap = new Map(scenes.map((s) => [s.id, `Scene ${s.number}${s.heading ? ` - ${s.heading}` : ""}`]));
  const dayMap = new Map(shootDays.map((d) => [d.id, `${d.date.toISOString().slice(0, 10)} (${d.status})`]));

  const exportedItems = items.map((item) => {
    const parsed = parseEmbeddedMeta<EquipmentTrackingMeta>(item.notes);
    const meta = parsed.meta ?? {};
    return {
      id: item.id,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      department: item.department,
      notes: parsed.plain ?? null,
      listingId: item.equipmentListingId,
      provider: meta.ownerProviderName ?? item.equipmentListing?.companyName ?? null,
      uniqueTag: meta.uniqueTag ?? null,
      dailyRate: meta.dailyRate ?? null,
      status: meta.currentStatus ?? "PLANNED",
      statusUpdatedAt: meta.currentStatusUpdatedAt ?? null,
      assignedCrewUserId: meta.assignedCrewUserId ?? null,
      assignedCrewName: meta.assignedCrewName ?? null,
      assignedDepartment: meta.assignedDepartment ?? item.department ?? null,
      assignedScenes: (meta.assignedSceneIds ?? []).map((id) => ({ id, label: sceneMap.get(id) ?? id })),
      assignedShootDays: (meta.assignedShootDayIds ?? []).map((id) => ({ id, label: dayMap.get(id) ?? id })),
      movementLogs: meta.movementLogs ?? [],
      issues: meta.issues ?? [],
      checklistEntries: meta.checklistEntries ?? [],
      openIssueCount: (meta.issues ?? []).filter((i) => i.status === "OPEN").length,
    };
  });

  if (format === "csv") {
    const header = [
      "itemId",
      "category",
      "description",
      "quantity",
      "provider",
      "uniqueTag",
      "status",
      "assignedCrew",
      "assignedDepartment",
      "shootDays",
      "scenes",
      "rowType",
      "eventType",
      "eventTime",
      "severity",
      "eventStatus",
      "eventDescription",
      "condition",
      "note",
      "proofPhotoUrl",
    ];
    const rows: string[] = [header.join(",")];

    for (const item of exportedItems) {
      const base = [
        item.id,
        item.category,
        item.description ?? "",
        item.quantity,
        item.provider ?? "",
        item.uniqueTag ?? "",
        item.status,
        item.assignedCrewName ?? "",
        item.assignedDepartment ?? "",
        item.assignedShootDays.map((d) => d.label).join(" | "),
        item.assignedScenes.map((s) => s.label).join(" | "),
      ];

      if (item.movementLogs.length === 0 && item.issues.length === 0) {
        rows.push([...base, "SUMMARY", "", "", "", "", "", "", "", ""].map(escCsv).join(","));
      }

      for (const log of item.movementLogs) {
        rows.push(
          [...base, "MOVEMENT", log.event, log.at, "", "", "", log.condition ?? "", log.note ?? "", ""]
            .map(escCsv)
            .join(","),
        );
      }
      for (const issue of item.issues) {
        rows.push(
          [
            ...base,
            "ISSUE",
            issue.type,
            issue.createdAt,
            issue.severity,
            issue.status,
            issue.description,
            "",
            "",
            "",
          ]
            .map(escCsv)
            .join(","),
        );
      }
      for (const checklist of item.checklistEntries) {
        rows.push(
          [
            ...base,
            "CHECKLIST",
            checklist.physicallyPresent ? "PRESENT" : "MISSING",
            checklist.checkedAt,
            "",
            "",
            checklist.label,
            "",
            checklist.note ?? "",
            checklist.photoUrl ?? "",
          ]
            .map(escCsv)
            .join(","),
        );
      }
    }

    return new NextResponse(rows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="equipment-tracking-${projectId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    projectId,
    totals: {
      items: exportedItems.length,
      units: exportedItems.reduce((s, i) => s + i.quantity, 0),
      movementEvents: exportedItems.reduce((s, i) => s + i.movementLogs.length, 0),
      issueEvents: exportedItems.reduce((s, i) => s + i.issues.length, 0),
      checklistEvents: exportedItems.reduce((s, i) => s + i.checklistEntries.length, 0),
      openIssues: exportedItems.reduce((s, i) => s + i.openIssueCount, 0),
    },
    items: exportedItems,
  });
}

