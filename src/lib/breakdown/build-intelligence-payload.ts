import { prisma } from "@/lib/prisma";
import { findBreakdownMakeupsForProject } from "@/lib/breakdown-makeup-db";
import { buildCountsByScene, computeSceneIntelligence } from "@/lib/breakdown/scene-intelligence";
import {
  buildProductionCatalog,
  countByDepartment,
  generateProductionInsights,
} from "@/lib/breakdown/production-insights";
import { computeReadinessMetrics, overallReadinessPercent } from "@/lib/breakdown/readiness";
import type { BreakdownCategoryKey, BreakdownIntelligencePayload } from "@/lib/breakdown/types";

export async function buildBreakdownIntelligence(projectId: string): Promise<BreakdownIntelligencePayload> {
  const [
    scenes,
    characters,
    props,
    locations,
    wardrobe,
    extras,
    vehicles,
    stunts,
    sfx,
    makeups,
    script,
    castingRoles,
    shootDays,
    budgetRecord,
  ] = await Promise.all([
    prisma.projectScene.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
    }),
    prisma.breakdownCharacter.findMany({ where: { projectId } }),
    prisma.breakdownProp.findMany({ where: { projectId } }),
    prisma.breakdownLocation.findMany({ where: { projectId } }),
    prisma.breakdownWardrobe.findMany({ where: { projectId } }),
    prisma.breakdownExtra.findMany({ where: { projectId } }),
    prisma.breakdownVehicle.findMany({ where: { projectId } }),
    prisma.breakdownStunt.findMany({ where: { projectId } }),
    prisma.breakdownSfx.findMany({ where: { projectId } }),
    findBreakdownMakeupsForProject(prisma, projectId),
    prisma.projectScript.findFirst({
      where: { projectId },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    prisma.castingRole.count({ where: { projectId, breakdownCharacterId: { not: null } } }),
    prisma.shootDay.count({ where: { projectId } }),
    prisma.projectBudget.findFirst({
      where: { projectId, isDefault: true },
      include: { _count: { select: { lines: true } } },
    }).then((b) => b ?? prisma.projectBudget.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { lines: true } } },
    })),
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

  const raw = { characters, props, locations, wardrobe, extras, vehicles, stunts, sfx, makeups };
  const catalog = buildProductionCatalog(raw, sceneIntel);
  const insights = generateProductionInsights(sceneIntel, catalog);
  const departmentCounts = countByDepartment(catalog);
  const locationsBookedCount = locations.filter((l) => l.locationListingId).length;

  const visualAssets = await prisma.projectVisualAsset.findMany({
    where: { projectId, category: "scene" },
    select: { id: true, sceneId: true, title: true },
  });
  const visualCountByScene = new Map<string, number>();
  for (const v of visualAssets) {
    if (!v.sceneId) continue;
    visualCountByScene.set(v.sceneId, (visualCountByScene.get(v.sceneId) ?? 0) + 1);
  }
  const basePath = `/creator/projects/${projectId}/pre-production`;
  const sceneIntelEnriched = sceneIntel.map((s) => ({
    ...s,
    visualAssetCount: visualCountByScene.get(s.sceneId) ?? 0,
    storyboardHref: `${basePath}/visual-planning?scene=${s.sceneNumber}`,
  }));
  const budgetLineCount = budgetRecord?._count.lines ?? 0;

  const hasScreenplay = Boolean(
    script?.versions?.[0]?.content?.trim() || script?.currentVersionId,
  );

  const readiness = computeReadinessMetrics({
    scenes: sceneIntelEnriched,
    hasScreenplay,
    castLinkedCount: castingRoles,
    locationsBookedCount,
    scheduleDayCount: shootDays,
    budgetLineCount: budgetLineCount,
  });

  const overallReadiness = overallReadinessPercent(readiness);
  const avgComplexity =
    sceneIntelEnriched.length > 0
      ? Math.round(sceneIntelEnriched.reduce((a, s) => a + s.complexityScore, 0) / sceneIntelEnriched.length)
      : 0;

  const breakdownStatus: "ready" | "partial" | "empty" =
    catalog.length > 0 ? "ready" : scenes.length > 0 ? "partial" : "empty";

  const hasStoryboards = visualAssets.length > 0;

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    summary: {
      sceneCount: scenes.length,
      assetCount: catalog.length,
      departmentsTouched: Object.values(departmentCounts).filter((n) => n > 0).length,
      overallReadiness,
      averageComplexity: avgComplexity,
      highRiskSceneCount: sceneIntelEnriched.filter((s) => s.productionRisk === "high").length,
    },
    scenes: sceneIntelEnriched,
    catalog,
    insights,
    readiness,
    departmentCounts,
    linkedTools: [
      {
        label: "Script Writing",
        href: `${basePath}/script-writing`,
        description: "Source screenplay and sync scene sluglines",
        status: hasScreenplay ? "ready" : "empty",
      },
      {
        label: "Production Scheduling",
        href: `${basePath}/production-scheduling`,
        description: "Stripboard and shoot days from breakdown",
        status: shootDays > 0 ? "ready" : breakdownStatus,
      },
      {
        label: "Budget Builder",
        href: `${basePath}/budget-builder`,
        description: "Estimated costs from tagged elements",
        status: budgetLineCount > 0 ? "ready" : breakdownStatus,
      },
      {
        label: "Casting Portal",
        href: `${basePath}/casting-portal`,
        description: "Sync cast from breakdown characters",
        status: castingRoles > 0 ? "ready" : breakdownStatus,
      },
      {
        label: "Location Marketplace",
        href: `${basePath}/location-marketplace`,
        description: "Book locations tagged in breakdown",
        status: locationsBookedCount > 0 ? "partial" : breakdownStatus,
      },
      {
        label: "Call Sheets",
        href: `/creator/projects/${projectId}/production/call-sheet-generator`,
        description: "Daily call sheets from schedule + breakdown",
        status: shootDays > 0 ? "partial" : "empty",
      },
      {
        label: "Risk & Insurance",
        href: `${basePath}/risk-insurance`,
        description: "Auto-detected risks from stunts, SFX, locations",
        status: sceneIntelEnriched.some((s) => s.productionRisk === "high") ? "partial" : breakdownStatus,
      },
      {
        label: "Visual Planning",
        href: `${basePath}/visual-planning`,
        description: "Storyboards, shot frames, and scene visuals",
        status: hasStoryboards ? "ready" : breakdownStatus,
      },
      {
        label: "Production Readiness",
        href: `${basePath}/production-readiness`,
        description: "Overall prep score across departments",
        status: overallReadiness >= 70 ? "ready" : overallReadiness >= 40 ? "partial" : "empty",
      },
    ],
  };
}
