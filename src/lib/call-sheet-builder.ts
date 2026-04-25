import { prisma } from "@/lib/prisma";
import { buildProductionDataEngine, type ProductionDayRecord } from "@/lib/production-day-engine";
import { SIGNED_CONTRACT_STATUSES } from "@/lib/contract-template-engine";
import { parseEmbeddedMeta, type LocationMarketMeta } from "@/lib/marketplace-profile-meta";
import { parseRiskItemDescription } from "@/lib/risk-insurance-db";

export type CallSheetCastRow = {
  characterName: string;
  roleName: string;
  talentName: string | null;
  invitationStatus: string | null;
  callTime: string | null;
  wrapTime: string | null;
  /** Scene numbers this performer appears in today */
  scenesInvolved: string[];
  confirmed: boolean;
};

export type CallSheetLocationRow = {
  name: string;
  description: string | null;
  addressLine: string | null;
  source: "day_summary" | "scene_primary" | "breakdown";
};

export type CallSheetScheduleRow = {
  order: number;
  sceneNumber: string;
  heading: string | null;
  durationMinutes?: number;
  intExt?: string | null;
  timeOfDay?: string | null;
  description?: string | null;
  primaryLocationLabel?: string | null;
};

export type CallSheetTaskRow = {
  title: string;
  status: string;
  department: string | null;
  priority: string | null;
};

export type CallSheetHeader = {
  productionTitle: string;
  productionCompany: string | null;
  shootDayNumber: number;
  totalShootDays: number;
  dateIso: string;
  primaryLocationSummary: string | null;
};

export type CallSheetTiming = {
  generalCall: string | null;
  estimatedWrap: string | null;
  mealBreakNotes: string | null;
};

export type CallSheetSafetyLine = {
  category: string;
  line: string;
  severity?: string | null;
};

/** Build call sheet JSON snapshots from schedule, breakdown, casting, crew, locations, equipment, tasks, contracts, and risk. */
export async function buildCallSheetPayload(projectId: string, shootDayId: string) {
  const [engine, signedContracts, projectBrief, tasks, riskPlan, unsignedContractCount] = await Promise.all([
      buildProductionDataEngine(prisma, projectId, null),
      prisma.projectContract.findMany({
        where: {
          projectId,
          status: { in: [...SIGNED_CONTRACT_STATUSES] },
        },
        include: {
          castingTalent: { select: { name: true } },
          locationListing: { select: { name: true } },
        },
      }),
      prisma.originalProject.findUnique({
        where: { id: projectId },
        select: {
          title: true,
          pitches: { take: 1, orderBy: { updatedAt: "desc" }, select: { productionCompany: true } },
        },
      }),
      prisma.projectTask.findMany({
        where: { projectId, shootDayId },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        select: { title: true, status: true, department: true, priority: true },
        take: 40,
      }),
      prisma.riskPlan.findUnique({
        where: { projectId },
        include: { items: { orderBy: { createdAt: "desc" } } },
      }),
      prisma.projectContract.count({
        where: { projectId, NOT: { status: { in: [...SIGNED_CONTRACT_STATUSES] } } },
      }),
    ]);

  if (!engine) return null;
  const day = engine.productionDays.find((d) => d.id === shootDayId);
  if (!day) return null;

  const sceneIds = day.scenes.map((s) => s.sceneId);
  const sceneRows = sceneIds.length
    ? await prisma.projectScene.findMany({
        where: { projectId, id: { in: sceneIds } },
        select: {
          id: true,
          number: true,
          intExt: true,
          timeOfDay: true,
          summary: true,
          primaryLocation: {
            select: {
              name: true,
              locationListing: {
                select: { name: true, address: true, city: true, province: true, rules: true },
              },
            },
          },
          breakdownCharacters: { select: { id: true, name: true } },
        },
      })
    : [];

  const sceneById = new Map(sceneRows.map((s) => [s.id, s]));

  const signedActorNames = new Set(
    signedContracts
      .filter((c) => c.castingTalent?.name)
      .map((c) => (c.castingTalent!.name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const signedLocationNames = new Set(
    signedContracts
      .filter((c) => c.locationListing?.name)
      .map((c) => (c.locationListing!.name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  const hasActorContractGating = signedActorNames.size > 0;
  const hasLocationContractGating = signedLocationNames.size > 0;

  const totalShootDays = engine.productionDays.length;

  function scenesInvolvedForCast(
    dayScenes: ProductionDayRecord["scenes"],
    cast: ProductionDayRecord["castRequired"][number],
  ): string[] {
    const nums: string[] = [];
    const roleLower = (cast.roleOrCharacter || "").trim().toLowerCase();
    for (const s of dayScenes) {
      const row = sceneById.get(s.sceneId);
      if (!row?.breakdownCharacters?.length) continue;
      if (cast.key.startsWith("character:")) {
        const cid = cast.key.slice("character:".length);
        if (row.breakdownCharacters.some((b) => b.id === cid)) nums.push(s.number);
      } else if (roleLower && row.breakdownCharacters.some((b) => (b.name || "").trim().toLowerCase() === roleLower)) {
        nums.push(s.number);
      }
    }
    return nums;
  }

  const castFiltered = day.castRequired.filter(
    (c) => !hasActorContractGating || signedActorNames.has((c.name || "").trim().toLowerCase()),
  );

  const cast: CallSheetCastRow[] = castFiltered.map((c) => ({
    characterName: c.roleOrCharacter,
    roleName: c.roleOrCharacter,
    talentName: c.name ?? null,
    invitationStatus: c.name ? "CONFIRMED" : null,
    callTime: c.callTime ?? day.callTime,
    wrapTime: c.wrapTime ?? day.wrapTime,
    scenesInvolved: scenesInvolvedForCast(day.scenes, c),
    confirmed:
      !hasActorContractGating || ((c.name || "").trim().length > 0 && signedActorNames.has((c.name || "").trim().toLowerCase())),
  }));

  const crew = day.crewRequired.map((c) => ({
    role: c.role,
    name: c.name,
    department: c.department,
    callTime: c.callTime ?? day.callTime,
    wrapTime: c.wrapTime ?? day.wrapTime,
  }));

  const locationByKey = new Map<string, CallSheetLocationRow>();
  if (day.location) {
    locationByKey.set(`day:${day.location}`.toLowerCase(), {
      name: day.location,
      description: day.notes,
      addressLine: null,
      source: "day_summary",
    });
  }
  for (const s of day.scenes) {
    const row = sceneById.get(s.sceneId);
    const pl = row?.primaryLocation;
    const listingName = pl?.locationListing?.name?.trim();
    const locName = (pl?.name || listingName || "").trim();
    if (!locName) continue;
    const addrParts = [pl?.locationListing?.address, pl?.locationListing?.city, pl?.locationListing?.province].filter(
      Boolean,
    );
    const addressLine = addrParts.length ? addrParts.join(", ") : null;
    const rulesMeta = parseEmbeddedMeta<LocationMarketMeta>(pl?.locationListing?.rules ?? null);
    const desc = [rulesMeta.plain, rulesMeta.meta?.restrictions ? `Restrictions: ${rulesMeta.meta.restrictions}` : null]
      .filter(Boolean)
      .join(" · ") || null;
    locationByKey.set(locName.toLowerCase(), {
      name: locName,
      description: desc,
      addressLine,
      source: "scene_primary",
    });
  }

  let locations = [...locationByKey.values()];
  if (hasLocationContractGating) {
    locations = locations.filter((loc) => signedLocationNames.has((loc.name || "").trim().toLowerCase()));
  }
  if (locations.length === 0) {
    locations = [
      {
        name: day.location ?? "TBD",
        description: null,
        addressLine: null,
        source: "day_summary",
      },
    ];
  }

  const schedule: CallSheetScheduleRow[] = day.scenes.map((s) => {
    const row = sceneById.get(s.sceneId);
    const locLabel = row?.primaryLocation?.name || row?.primaryLocation?.locationListing?.name || null;
    return {
      order: s.order,
      sceneNumber: s.number,
      heading: s.heading,
      durationMinutes: s.estimatedShootDurationMinutes,
      intExt: row?.intExt ?? null,
      timeOfDay: row?.timeOfDay ?? null,
      description: row?.summary ?? s.description ?? null,
      primaryLocationLabel: locLabel,
    };
  });

  const productionTitle = projectBrief?.title ?? engine.projectTitle ?? "Production";
  const productionCompany = projectBrief?.pitches?.[0]?.productionCompany?.trim() || null;

  const header: CallSheetHeader = {
    productionTitle,
    productionCompany,
    shootDayNumber: day.shootDayNumber,
    totalShootDays,
    dateIso: day.date,
    primaryLocationSummary: day.location,
  };

  const timing: CallSheetTiming = {
    generalCall: day.callTime,
    estimatedWrap: day.wrapTime,
    mealBreakNotes: day.logistics.cateringNotes ?? null,
  };

  const daySceneIdSet = new Set(day.scenes.map((s) => s.sceneId));
  const safetyLines: CallSheetSafetyLine[] = [];
  const openRisk = (riskPlan?.items ?? []).filter((i) => i.status !== "DONE");
  for (const item of openRisk) {
    const { plain, meta } = parseRiskItemDescription(item.description);
    const linkedDay = meta.linkedShootDayIds?.includes(shootDayId);
    const linkedScene = meta.linkedSceneIds?.some((id) => daySceneIdSet.has(id));
    if (!linkedDay && !linkedScene) continue;
    const line =
      (plain ?? "")
        .replace(new RegExp(`^\\[${item.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*`, "i"), "")
        .trim() ||
      meta.title ||
      item.description.slice(0, 120);
    safetyLines.push({
      category: item.category,
      line,
      severity: meta.severity ?? null,
    });
  }
  if (safetyLines.length === 0) {
    for (const item of openRisk.slice(0, 6)) {
      const { plain, meta } = parseRiskItemDescription(item.description);
      const line =
        (plain ?? "")
          .replace(new RegExp(`^\\[${item.category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\s*`, "i"), "")
          .trim() ||
        meta.title ||
        item.description.slice(0, 120);
      safetyLines.push({ category: item.category, line, severity: meta.severity ?? null });
    }
  }

  const taskRows: CallSheetTaskRow[] = tasks.map((t) => ({
    title: t.title,
    status: t.status,
    department: t.department,
    priority: t.priority,
  }));

  const meta = {
    shootDayId: day.id,
    date: day.date,
    unit: null as string | null,
    callTime: day.callTime,
    wrapTime: day.wrapTime,
    locationSummary: day.location,
    dayNotes: day.notes,
    scenesBeingShot: day.scenes.map((s) => `Sc. ${s.number}`).join(", "),
    weather: day.weather,
    logistics: day.logistics,
    equipment: day.equipmentRequired,
    shareablePath: day.callSheetOutput.formats.shareablePath,
    mobilePath: day.callSheetOutput.formats.mobilePath,
    contractConfirmation: {
      signedContractsCount: signedContracts.length,
      actorContractGateApplied: hasActorContractGating,
      locationContractGateApplied: hasLocationContractGating,
      unsignedContractCount,
    },
    header,
    timing,
    departmentNotes: day.logistics,
  };

  return {
    header,
    timing,
    meta,
    cast,
    crew,
    locations,
    schedule,
    tasks: taskRows,
    safety: safetyLines,
  };
}

export function snapshotToJsonStrings(payload: NonNullable<Awaited<ReturnType<typeof buildCallSheetPayload>>>) {
  return {
    castJson: JSON.stringify(payload.cast),
    crewJson: JSON.stringify(payload.crew),
    locationsJson: JSON.stringify(payload.locations),
    scheduleJson: JSON.stringify({
      meta: payload.meta,
      rows: payload.schedule,
      tasks: payload.tasks,
      safety: payload.safety,
      header: payload.header,
      timing: payload.timing,
    }),
  };
}
