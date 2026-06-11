import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { type BudgetTemplate, runBudgetEngine } from "@/lib/budget-engine";
import type { ModocActionPayload } from "./action-types";
import type { ModocActionResult } from "./actions";
import {
  inferProductionContext,
  locationKeywordsForBreakdown,
} from "./va-script-inference";
import { resolveScriptText } from "./va-script-text";

const BUDGET_TEMPLATES = new Set<string>([
  "SHORT_FILM",
  "INDIE_FILM",
  "FEATURE_FILM",
  "TV_EPISODE",
  "SERIES_PILOT",
  "STUDENT_PRODUCTION",
  "COMMERCIAL_SHOOT",
]);

function resolveBudgetTemplate(raw?: string): BudgetTemplate {
  const upper = (raw ?? "SHORT_FILM").toUpperCase();
  return BUDGET_TEMPLATES.has(upper) ? (upper as BudgetTemplate) : "SHORT_FILM";
}

type MarketplaceLocation = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  dailyRate: number | null;
};

async function fetchMarketplaceLocations(city: string | null): Promise<MarketplaceLocation[]> {
  const listings = await prisma.locationListing.findMany({
    take: 120,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, city: true, dailyRate: true },
  });
  if (!city) return listings;
  const cityLower = city.toLowerCase();
  const inCity = listings.filter((l) => l.city?.toLowerCase().includes(cityLower));
  return inCity.length > 0 ? inCity : listings;
}

function scoreLocationMatch(
  breakdownName: string,
  description: string | null,
  listing: MarketplaceLocation,
): number {
  const keys = locationKeywordsForBreakdown(breakdownName, description);
  const listingText = `${listing.name} ${listing.type}`.toLowerCase();
  let score = 0;
  for (const k of keys) {
    if (listingText.includes(k)) score += 2;
  }
  if (listing.dailyRate != null && listing.dailyRate > 0) score += 1;
  return score;
}

function pickBestListing(
  name: string,
  description: string | null,
  listings: MarketplaceLocation[],
): MarketplaceLocation | null {
  let best: MarketplaceLocation | null = null;
  let bestScore = 0;
  for (const listing of listings) {
    const score = scoreLocationMatch(name, description, listing);
    if (score > bestScore) {
      bestScore = score;
      best = listing;
    }
  }
  return bestScore >= 2 ? best : listings.find((l) => l.dailyRate != null) ?? null;
}

/** Default ZAR day rates when marketplace has no explicit crew/cast rates. */
export const CAST_DAY_RATES_ZAR: Record<string, number> = {
  LEAD: 3500,
  SUPPORTING: 1800,
  EXTRA: 450,
};

export const CREW_DAY_RATES_ZAR: Record<string, number> = {
  Director: 4500,
  "Director of Photography": 3800,
  "1st AD": 2800,
  Producer: 3500,
  "Production Designer": 2600,
  "Sound Recordist": 2200,
  Gaffer: 2400,
  Editor: 2000,
};

/**
 * Generate budget from breakdown + script-aware marketplace assumptions
 * (locations, crew, cast, equipment categories).
 */
export async function vaGenerateSmartBudget(
  projectId: string,
  payload: ModocActionPayload,
  userId?: string,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const template = resolveBudgetTemplate(payload.template);

  const [project, scriptRow, breakdownLocs, characters, scenes, shootDays] = await Promise.all([
    prisma.originalProject.findUnique({
      where: { id: projectId },
      select: { title: true, linkedCatalogueContent: { select: { duration: true }, take: 1 } },
    }),
    prisma.projectScript.findFirst({
      where: { projectId },
      select: {
        currentVersionId: true,
        versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, content: true } },
      },
    }),
    prisma.breakdownLocation.findMany({
      where: { projectId },
      select: { id: true, name: true, description: true, locationListingId: true, sceneId: true },
    }),
    prisma.breakdownCharacter.findMany({
      where: { projectId },
      select: { name: true, importance: true },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true, pageCount: true, intExt: true, timeOfDay: true, storyDay: true },
    }),
    prisma.shootDay.count({ where: { projectId } }),
  ]);

  const scriptText = scriptRow ? resolveScriptText(scriptRow) : "";
  const inference = inferProductionContext({
    scriptText,
    sceneHeadings: scenes.map((s) => s.heading ?? ""),
    sceneCount: scenes.length,
  });

  const marketplaceLocs = await fetchMarketplaceLocations(inference.primaryCity);
  const assumptions: string[] = [
    `Region: ${inference.regionLabel}`,
    `Estimated shoot days: ${Math.max(shootDays, inference.estimatedShootDays)}`,
  ];
  const assumptionRows: Array<{
    category: string;
    label: string;
    detail: string;
    amount: number | null;
    sourceType: string;
    sourceId: string | null;
  }> = [
    {
      category: "REGION",
      label: inference.regionLabel,
      detail: `Inferred from script and scene headings (${inference.primaryCity ?? "default SA"})`,
      amount: null,
      sourceType: "SCRIPT",
      sourceId: null,
    },
    {
      category: "SHOOT_DAYS",
      label: `${Math.max(shootDays, inference.estimatedShootDays)} shoot day(s)`,
      detail: `Based on ${scenes.length} scene(s) and schedule`,
      amount: null,
      sourceType: "SCRIPT",
      sourceId: null,
    },
  ];

  await prisma.projectProductionContext.upsert({
    where: { projectId },
    create: {
      projectId,
      primaryCity: inference.primaryCity,
      country: inference.country,
      regionLabel: inference.regionLabel,
      estimatedShootDays: inference.estimatedShootDays,
      intSceneCount: inference.intSceneCount,
      extSceneCount: inference.extSceneCount,
      settingHints: JSON.stringify(inference.settingHints),
    },
    update: {
      primaryCity: inference.primaryCity,
      country: inference.country,
      regionLabel: inference.regionLabel,
      estimatedShootDays: inference.estimatedShootDays,
      intSceneCount: inference.intSceneCount,
      extSceneCount: inference.extSceneCount,
      settingHints: JSON.stringify(inference.settingHints),
    },
  });

  let linkedLocations = 0;
  for (const loc of breakdownLocs) {
    if (loc.locationListingId) continue;
    const match = pickBestListing(loc.name, loc.description, marketplaceLocs);
    if (!match) continue;
    await prisma.breakdownLocation.update({
      where: { id: loc.id },
      data: {
        locationListingId: match.id,
        marketplaceLinkedAt: new Date(),
        marketplaceLinkedBy: "VA",
        marketplaceMatchNote: `Matched marketplace listing "${match.name}"${match.city ? ` (${match.city})` : ""}`,
      },
    });
    loc.locationListingId = match.id;
    linkedLocations++;
    const matchDetail = `Location "${loc.name}" → marketplace "${match.name}" (${match.city ?? "—"}) @ R${(match.dailyRate ?? 0).toLocaleString("en-ZA")}/day`;
    assumptions.push(matchDetail);
    assumptionRows.push({
      category: "LOCATIONS",
      label: loc.name,
      detail: matchDetail,
      amount: match.dailyRate,
      sourceType: "MARKETPLACE",
      sourceId: match.id,
    });
  }

  // Reload project graph for budget engine (with linked locations)
  const fullProject = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      linkedCatalogueContent: { select: { duration: true }, take: 1 },
      projectBudget: { include: { lines: true } },
      productionExpenses: { select: { amount: true, department: true } },
      crewRoleNeeds: { select: { department: true, role: true, seniority: true, notes: true, dailyRate: true } },
      castingRoles: { select: { name: true, status: true, dailyRate: true } },
      equipmentPlanItems: { select: { category: true, quantity: true, notes: true } },
      shootDays: { select: { id: true, scenes: { select: { sceneId: true } } } },
      scenes: {
        include: {
          primaryLocation: {
            include: { locationListing: { select: { dailyRate: true, rules: true, name: true, city: true } } },
          },
          breakdownCharacters: { select: { importance: true } },
          breakdownProps: { select: { id: true } },
          breakdownWardrobes: { select: { id: true } },
          breakdownExtras: { select: { quantity: true } },
          breakdownVehicles: { select: { id: true } },
          breakdownStunts: { select: { id: true } },
          breakdownSfxs: { select: { id: true } },
          breakdownMakeups: { select: { id: true } },
        },
      },
    },
  });

  if (!fullProject) {
    return { ok: false, error: "Project not found", status: 404 };
  }

  let budget = fullProject.projectBudget;
  if (!budget) {
    budget = await prisma.projectBudget.create({
      data: { projectId, template, currency: "ZAR", totalPlanned: 0 },
      include: { lines: true },
    });
  }

  const shootDayCounts = new Map<string, number>();
  for (const day of fullProject.shootDays) {
    for (const link of day.scenes) {
      shootDayCounts.set(link.sceneId, (shootDayCounts.get(link.sceneId) ?? 0) + 1);
    }
  }

  const engine = runBudgetEngine({
    template,
    projectDurationMinutes: fullProject.linkedCatalogueContent[0]?.duration ?? null,
    logisticsDistanceKm: null,
    shootDaysCount: Math.max(fullProject.shootDays.length, inference.estimatedShootDays),
    scenes: fullProject.scenes.map((scene) => ({
      id: scene.id,
      number: scene.number,
      heading: scene.heading,
      intExt: scene.intExt,
      timeOfDay: scene.timeOfDay,
      pageCount: scene.pageCount,
      storyDay: scene.storyDay,
      primaryLocationName: scene.primaryLocation?.name ?? null,
      locationDailyRate: scene.primaryLocation?.locationListing?.dailyRate ?? null,
      locationRules: scene.primaryLocation?.locationListing?.rules ?? null,
      characters: scene.breakdownCharacters,
      propsCount: scene.breakdownProps.length,
      wardrobeCount: scene.breakdownWardrobes.length,
      extrasCount: scene.breakdownExtras.length,
      extrasQty: scene.breakdownExtras.reduce((acc, row) => acc + (row.quantity ?? 0), 0),
      vehiclesCount: scene.breakdownVehicles.length,
      stuntsCount: scene.breakdownStunts.length,
      sfxCount: scene.breakdownSfxs.length,
      makeupsCount: scene.breakdownMakeups.length,
      shootDaysAssigned: shootDayCounts.get(scene.id) ?? 0,
    })),
    manualLines: (budget.lines ?? []).map((line) => ({
      department: line.department,
      name: line.name,
      quantity: line.quantity,
      unitCost: line.unitCost,
      total: line.total,
    })),
    expenses: fullProject.productionExpenses,
    crewNeeds: fullProject.crewRoleNeeds,
    castRoles: fullProject.castingRoles.map((role) => ({ name: role.name, status: role.status, linkedSalaryAmount: role.dailyRate ?? null })),
    equipmentItems: fullProject.equipmentPlanItems.map((item) => ({
      category: item.category,
      quantity: item.quantity,
      notes: item.notes,
    })),
  });

  const supplemental: Array<{
    department: string;
    name: string;
    quantity: number;
    unitCost: number;
    total: number;
    notes: string;
  }> = [];

  const shootDayEstimate = Math.max(fullProject.shootDays.length, inference.estimatedShootDays, 1);

  // Marketplace location lines (unique listings)
  const usedListingIds = new Set<string>();
  for (const loc of breakdownLocs) {
    const listingId = loc.locationListingId;
    if (!listingId || usedListingIds.has(listingId)) continue;
    const listing = marketplaceLocs.find((l) => l.id === listingId);
    if (!listing?.dailyRate) continue;
    usedListingIds.add(listingId);
    const days = Math.max(1, Math.ceil(shootDayEstimate / Math.max(breakdownLocs.length, 1)));
    supplemental.push({
      department: "LOCATIONS",
      name: `Location · ${listing.name}${listing.city ? ` (${listing.city})` : ""}`,
      quantity: days,
      unitCost: listing.dailyRate,
      total: days * listing.dailyRate,
      notes: `VA assumption from marketplace listing ${listing.id}`,
    });
  }

  const castRateByName = new Map(
    fullProject.castingRoles.map((role) => [
      role.name.toLowerCase(),
      role.dailyRate != null && role.dailyRate > 0 ? role.dailyRate : null,
    ]),
  );

  // Cast lines from breakdown characters (prefer casting role / marketplace dailyRate)
  for (const char of characters) {
    const imp = (char.importance ?? "SUPPORTING").toUpperCase();
    const linkedRate = castRateByName.get(char.name.toLowerCase());
    const dayRate = linkedRate ?? CAST_DAY_RATES_ZAR[imp] ?? CAST_DAY_RATES_ZAR.SUPPORTING;
    supplemental.push({
      department: "CAST",
      name: `Cast · ${char.name}`,
      quantity: shootDayEstimate,
      unitCost: dayRate,
      total: shootDayEstimate * dayRate,
      notes: linkedRate
        ? `VA assumption — casting role daily rate for ${char.name}`
        : `VA assumption (${imp}) for ${inference.regionLabel}`,
    });
    assumptionRows.push({
      category: "CAST",
      label: char.name,
      detail: `${imp} cast · R${dayRate.toLocaleString("en-ZA")}/day × ${shootDayEstimate} day(s)`,
      amount: dayRate,
      sourceType: linkedRate ? "MARKETPLACE" : "DEFAULT",
      sourceId: null,
    });
  }

  // Starter crew if none exist
  const existingCrew = await prisma.crewRoleNeed.count({ where: { projectId } });
  const starterRoles = ["Director", "Director of Photography", "1st AD", "Sound Recordist", "Gaffer"];
  if (existingCrew === 0) {
    for (const role of starterRoles) {
      const rate = CREW_DAY_RATES_ZAR[role] ?? 1800;
      await prisma.crewRoleNeed.create({
        data: {
          projectId,
          role,
          department: role.includes("Sound") ? "Sound" : "Production",
          notes: "Added by VA smart budget",
          dailyRate: rate,
        },
      });
    }
    assumptions.push(`Added starter crew roles: ${starterRoles.join(", ")}`);
  }

  const crewNeedsForBudget =
    existingCrew === 0
      ? starterRoles.map((role) => ({
          role,
          dailyRate: CREW_DAY_RATES_ZAR[role] ?? 1800,
        }))
      : await prisma.crewRoleNeed.findMany({
          where: { projectId },
          select: { role: true, dailyRate: true },
        });

  for (const need of crewNeedsForBudget) {
    const linkedRate = need.dailyRate != null && need.dailyRate > 0 ? need.dailyRate : null;
    const dayRate = linkedRate ?? CREW_DAY_RATES_ZAR[need.role] ?? 1800;
    supplemental.push({
      department: "CREW",
      name: `Crew · ${need.role}`,
      quantity: shootDayEstimate,
      unitCost: dayRate,
      total: shootDayEstimate * dayRate,
      notes: linkedRate
        ? `VA assumption — crew need daily rate for ${need.role}`
        : `VA market-rate assumption (${inference.regionLabel})`,
    });
    assumptionRows.push({
      category: "CREW",
      label: need.role,
      detail: `Crew · R${dayRate.toLocaleString("en-ZA")}/day × ${shootDayEstimate} day(s)`,
      amount: dayRate,
      sourceType: linkedRate ? "MARKETPLACE" : "DEFAULT",
      sourceId: null,
    });
  }

  // Equipment categories from marketplace listings
  const equipListings = await prisma.equipmentListing.findMany({
    take: 40,
    orderBy: { createdAt: "desc" },
    select: { id: true, companyName: true, category: true, dailyRate: true },
  });
  const categoriesWanted = ["Camera", "Lighting", "Grip", "Sound"];
  const equipFallback: Record<string, number> = { Camera: 2800, Lighting: 1800, Grip: 1200, Sound: 900 };
  for (const cat of categoriesWanted) {
    const match = equipListings.find((e) => e.category.toLowerCase().includes(cat.toLowerCase()));
    const daily = match?.dailyRate ?? equipFallback[cat] ?? 1000;
    supplemental.push({
      department: "EQUIPMENT",
      name: match ? `Equipment · ${cat} (${match.companyName})` : `Equipment · ${cat} package`,
      quantity: shootDayEstimate,
      unitCost: daily,
      total: shootDayEstimate * daily,
      notes: match
        ? `VA assumption — marketplace listing ${match.id}`
        : `VA assumption — typical ${cat.toLowerCase()} day rate ZAR`,
    });
    if (match) {
      assumptionRows.push({
        category: "EQUIPMENT",
        label: cat,
        detail: `Equipment · ${cat} via ${match.companyName}`,
        amount: daily,
        sourceType: "MARKETPLACE",
        sourceId: match.id,
      });
      const existing = await prisma.equipmentPlanItem.findFirst({
        where: { projectId, equipmentListingId: match.id },
      });
      if (!existing) {
        await prisma.equipmentPlanItem.create({
          data: {
            projectId,
            category: cat,
            description: match.companyName,
            quantity: 1,
            equipmentListingId: match.id,
            notes: "Added by VA smart budget",
          },
        });
      }
    }
  }

  const engineLines = engine.sceneLineItems.map((item) => ({
    department: item.department,
    name: item.name,
    quantity: item.quantity,
    unitCost: item.unitCost,
    total: item.total,
    notes: item.notes,
  }));

  const allLines = [...engineLines, ...supplemental];

  await prisma.$transaction(async (tx) => {
    await tx.projectBudgetLine.deleteMany({ where: { budgetId: budget!.id } });
    for (const line of allLines) {
      await tx.projectBudgetLine.create({
        data: {
          budgetId: budget!.id,
          department: line.department,
          name: line.name,
          quantity: line.quantity,
          unitCost: line.unitCost,
          total: line.total,
          notes: line.notes || null,
        },
      });
    }
    const totalPlanned = allLines.reduce((s, l) => s + l.total, 0);
    await tx.projectBudgetAssumption.deleteMany({ where: { budgetId: budget!.id } });
    for (const row of assumptionRows) {
      await tx.projectBudgetAssumption.create({
        data: {
          projectId,
          budgetId: budget!.id,
          category: row.category,
          label: row.label,
          detail: row.detail,
          amount: row.amount,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
        },
      });
    }
    await tx.projectBudget.update({
      where: { id: budget!.id },
      data: {
        totalPlanned,
        template,
        generationSource: "VA_SMART",
        lastGeneratedAt: new Date(),
        lastGeneratedById: userId ?? null,
        inferredRegion: inference.regionLabel,
        estimatedShootDays: shootDayEstimate,
      },
    });
  });

  return {
    ok: true,
    message: `Smart budget for "${project?.title ?? "project"}": ${allLines.length} lines, estimated R${allLines.reduce((s, l) => s + l.total, 0).toLocaleString("en-ZA")}. Linked ${linkedLocations} breakdown location(s) to marketplace listings. Assumptions: ${assumptions.slice(0, 4).join("; ")}${assumptions.length > 4 ? "…" : ""}`,
    data: {
      lineCount: allLines.length,
      linkedLocations,
      region: inference.regionLabel,
      assumptions,
    },
  };
}
