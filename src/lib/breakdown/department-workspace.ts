import { prisma } from "@/lib/prisma";
import { BREAKDOWN_DEPARTMENTS, departmentById } from "@/lib/breakdown/departments";
import { findBreakdownMakeupsForProject } from "@/lib/breakdown-makeup-db";
import type { BreakdownDepartmentId, CatalogAsset, BreakdownCategoryKey } from "@/lib/breakdown/types";
import { buildProductionCatalog } from "@/lib/breakdown/production-insights";
import { computeSceneIntelligence, buildCountsByScene } from "@/lib/breakdown/scene-intelligence";

export type DepartmentWorkspaceAsset = CatalogAsset & {
  poStatus: string | null;
  poNumber: string | null;
  rentalStatus: string | null;
  notes: string | null;
};

export type DepartmentWorkspacePayload = {
  departmentId: BreakdownDepartmentId;
  label: string;
  color: string;
  assets: DepartmentWorkspaceAsset[];
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    status: string;
    vendorName: string | null;
    total: number;
    department: string | null;
  }>;
  equipmentItems: Array<{
    id: string;
    description: string;
    quantity: number;
    department: string | null;
    listingLinked: boolean;
  }>;
  stats: {
    assetCount: number;
    openPoCount: number;
    approvedPoCount: number;
    equipmentCount: number;
  };
};

const DEPT_PO_ALIASES: Record<BreakdownDepartmentId, string[]> = {
  cast: ["Cast", "Talent"],
  extras_bg: ["Extras", "Background"],
  locations: ["Locations", "Location"],
  props: ["Props", "Art", "Set Dressing"],
  wardrobe: ["Wardrobe", "Costume"],
  hair_makeup: ["Hair", "Makeup", "HMU"],
  vehicles: ["Vehicles", "Transportation", "Transport"],
  stunts: ["Stunts", "Safety"],
  sfx_vfx: ["SFX", "VFX", "Special Effects", "Visual Effects"],
  camera_grip: ["Camera", "Grip", "Equipment"],
  sound: ["Sound"],
  transport: ["Transportation", "Logistics"],
  safety_legal: ["Legal", "Insurance", "Permits"],
  post: ["Post", "Post Production"],
};

function poMatchesDepartment(poDept: string | null, deptId: BreakdownDepartmentId): boolean {
  if (!poDept) return false;
  const norm = poDept.toLowerCase();
  return DEPT_PO_ALIASES[deptId].some((a) => norm.includes(a.toLowerCase()));
}

function fuzzyPoMatch(assetLabel: string, lineDescription: string): boolean {
  const a = assetLabel.toLowerCase();
  const b = lineDescription.toLowerCase();
  return a.includes(b) || b.includes(a) || a.split(/\s+/).some((w) => w.length > 3 && b.includes(w));
}

export async function buildDepartmentWorkspace(
  projectId: string,
  departmentId: BreakdownDepartmentId,
): Promise<DepartmentWorkspacePayload> {
  const dept = departmentById(departmentId);

  const [characters, props, locations, wardrobe, extras, vehicles, stunts, sfx, makeups, scenes, pos, equip] =
    await Promise.all([
      prisma.breakdownCharacter.findMany({ where: { projectId } }),
      prisma.breakdownProp.findMany({ where: { projectId } }),
      prisma.breakdownLocation.findMany({ where: { projectId } }),
      prisma.breakdownWardrobe.findMany({ where: { projectId } }),
      prisma.breakdownExtra.findMany({ where: { projectId } }),
      prisma.breakdownVehicle.findMany({ where: { projectId } }),
      prisma.breakdownStunt.findMany({ where: { projectId } }),
      prisma.breakdownSfx.findMany({ where: { projectId } }),
      findBreakdownMakeupsForProject(prisma, projectId),
      prisma.projectScene.findMany({ where: { projectId }, orderBy: { number: "asc" } }),
      prisma.purchaseOrder.findMany({
        where: { projectId },
        include: { vendor: { select: { displayName: true } }, lines: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.equipmentPlanItem.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

  const countItems: Array<{ sceneId: string | null; category: BreakdownCategoryKey }> = [
    ...characters.map((r) => ({ sceneId: r.sceneId, category: "characters" as const })),
    ...props.map((r) => ({ sceneId: r.sceneId, category: "props" as const })),
    ...locations.map((r) => ({ sceneId: r.sceneId, category: "locations" as const })),
    ...wardrobe.map((r) => ({ sceneId: r.sceneId, category: "wardrobe" as const })),
    ...extras.map((r) => ({ sceneId: r.sceneId, category: "extras" as const })),
    ...vehicles.map((r) => ({ sceneId: r.sceneId, category: "vehicles" as const })),
    ...stunts.map((r) => ({ sceneId: r.sceneId, category: "stunts" as const })),
    ...sfx.map((r) => ({ sceneId: r.sceneId, category: "sfx" as const })),
    ...makeups.map((r) => ({ sceneId: r.sceneId, category: "makeups" as const })),
  ];
  const countsByScene = buildCountsByScene(countItems);

  const sceneIntel = scenes.map((s) =>
    computeSceneIntelligence(
      {
        id: s.id,
        number: s.number,
        heading: s.heading,
        storyDay: s.storyDay,
        intExt: s.intExt,
        timeOfDay: s.timeOfDay,
        summary: s.summary,
        pageCount: s.pageCount,
        status: s.status,
        breakdownAnalysis: s.breakdownAnalysis,
      },
      countsByScene,
    ),
  );

  const catalog = buildProductionCatalog(
    { characters, props, locations, wardrobe, extras, vehicles, stunts, sfx, makeups },
    sceneIntel,
  ).filter((a) => a.departmentId === departmentId);

  const deptPos = pos.filter((p) => poMatchesDepartment(p.department, departmentId));

  const assets: DepartmentWorkspaceAsset[] = catalog.map((asset) => {
    let poStatus: string | null = null;
    let poNumber: string | null = null;
    for (const po of deptPos) {
      const match = po.lines.some((l) => fuzzyPoMatch(asset.label, l.description));
      if (match) {
        poStatus = po.status;
        poNumber = po.poNumber;
        break;
      }
    }
    let rentalStatus: string | null = null;
    if (asset.category === "locations" && asset.meta?.locationListingId) {
      rentalStatus = "Booked";
    }
    if (asset.category === "vehicles" || asset.category === "props") {
      rentalStatus = poStatus ? "On PO" : null;
    }
    return { ...asset, poStatus, poNumber, rentalStatus, notes: asset.description };
  });

  const equipmentItems = equip
    .filter((e) => poMatchesDepartment(e.department, departmentId) || departmentId === "camera_grip")
    .map((e) => ({
      id: e.id,
      description: e.description ?? e.category,
      quantity: e.quantity,
      department: e.department,
      listingLinked: Boolean(e.equipmentListingId),
    }));

  return {
    departmentId,
    label: dept.label,
    color: dept.color,
    assets,
    purchaseOrders: deptPos.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      status: p.status,
      vendorName: p.vendor?.displayName ?? null,
      total: p.total,
      department: p.department,
    })),
    equipmentItems,
    stats: {
      assetCount: assets.length,
      openPoCount: deptPos.filter((p) => !["CLOSED", "CANCELLED", "REJECTED"].includes(p.status)).length,
      approvedPoCount: deptPos.filter((p) => ["APPROVED", "SENT", "PARTIAL", "CLOSED"].includes(p.status)).length,
      equipmentCount: equipmentItems.length,
    },
  };
}

export function listDepartmentIds(): BreakdownDepartmentId[] {
  return BREAKDOWN_DEPARTMENTS.map((d) => d.id);
}
