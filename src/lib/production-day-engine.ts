import {
  parseEmbeddedMeta,
  type EquipmentMarketMeta,
  type LocationMarketMeta,
} from "@/lib/marketplace-profile-meta";
const STRUCTURED_MARKER_START = "[ST_PRODUCTION_DAY_JSON]";
const STRUCTURED_MARKER_END = "[/ST_PRODUCTION_DAY_JSON]";

export type ProductionDayStructuredFields = {
  weather?: string | null;
  transportDetails?: string | null;
  pickupDropoffInfo?: string | null;
  accommodation?: string | null;
  cateringNotes?: string | null;
  callSheetNotes?: string | null;
};

export type ProductionConflict = {
  type: "ACTOR_DOUBLE_BOOKING" | "CREW_OVERLAP" | "EQUIPMENT_CONFLICT" | "OVERLOADED_DAY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  dayIds: string[];
};

export type ProductionDayRecord = {
  id: string;
  shootDayNumber: number;
  date: string;
  callTime: string | null;
  wrapTime: string | null;
  location: string | null;
  weather: string | null;
  notes: string | null;
  logistics: {
    transportDetails: string | null;
    pickupDropoffInfo: string | null;
    accommodation: string | null;
    cateringNotes: string | null;
  };
  scenes: Array<{
    sceneId: string;
    order: number;
    number: string;
    heading: string | null;
    description: string | null;
    estimatedShootDurationMinutes: number;
  }>;
  castRequired: Array<{
    key: string;
    name: string;
    roleOrCharacter: string;
    callTime: string | null;
    wrapTime: string | null;
    contactInfo: string | null;
  }>;
  crewRequired: Array<{
    key: string;
    name: string;
    role: string;
    department: string;
    callTime: string | null;
    wrapTime: string | null;
  }>;
  equipmentRequired: Array<{
    key: string;
    equipmentName: string;
    category: string;
    quantity: number;
    availability?: string | null;
    specifications?: string | null;
  }>;
  callSheetOutput: {
    productionTitle: string;
    shootDayInfo: {
      date: string;
      shootDayNumber: number;
      location: string | null;
      callTime: string | null;
      wrapTime: string | null;
      weather: string | null;
    };
    sceneBreakdown: Array<{
      order: number;
      sceneNumber: string;
      heading: string | null;
      durationMinutes: number;
    }>;
    castCalls: Array<{
      name: string;
      role: string;
      callTime: string | null;
      wrapTime: string | null;
      contactInfo: string | null;
    }>;
    crewCalls: Array<{
      name: string;
      role: string;
      department: string;
      callTime: string | null;
      wrapTime: string | null;
    }>;
    equipmentList: Array<{
      name: string;
      category: string;
      quantity: number;
      availability?: string | null;
      specifications?: string | null;
    }>;
    notes: string | null;
    formats: {
      pdfExportReady: boolean;
      shareablePath: string;
      mobilePath: string;
    };
  };
};

export type ProductionDataEngineResult = {
  projectTitle: string;
  script: { id: string; title: string; sceneCount: number } | null;
  scenes: Array<{
    id: string;
    number: string;
    heading: string | null;
    summary: string | null;
    status: string;
    pageCount: number | null;
    callSheetTags: {
      castCount: number;
      locationCount: number;
      propCount: number;
      equipmentHintCount: number;
      specialRequirementCount: number;
    };
  }>;
  productionDays: ProductionDayRecord[];
  conflicts: ProductionConflict[];
};

function parseTimeToMinutes(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mins)) return null;
  return h * 60 + mins;
}

function overlaps(aStart: number | null, aEnd: number | null, bStart: number | null, bEnd: number | null): boolean {
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return true;
  return aStart < bEnd && bStart < aEnd;
}

function normalizeText(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function buildSceneDurationMinutes(scene: {
  pageCount: number | null;
  breakdownProps: { id: string }[];
  breakdownStunts: { id: string }[];
  breakdownSfxs: { id: string }[];
  breakdownExtras: { quantity: number }[];
}): number {
  const pageFactor = Math.max(1, Number(scene.pageCount ?? 1));
  const base = Math.round(pageFactor * 50);
  const propPenalty = scene.breakdownProps.length * 4;
  const stuntPenalty = scene.breakdownStunts.length * 20;
  const sfxPenalty = scene.breakdownSfxs.length * 12;
  const extrasPenalty = scene.breakdownExtras.reduce((acc, e) => acc + Math.max(0, e.quantity - 1) * 2, 0);
  return Math.max(30, base + propPenalty + stuntPenalty + sfxPenalty + extrasPenalty);
}

export function parseShootDayNotes(dayNotes: string | null | undefined): {
  plainNotes: string | null;
  structured: ProductionDayStructuredFields;
} {
  const text = normalizeText(dayNotes);
  if (!text) return { plainNotes: null, structured: {} };

  const start = text.indexOf(STRUCTURED_MARKER_START);
  const end = text.indexOf(STRUCTURED_MARKER_END);
  if (start === -1 || end === -1 || end <= start) {
    return { plainNotes: text, structured: {} };
  }

  const jsonPayload = text.slice(start + STRUCTURED_MARKER_START.length, end).trim();
  const before = text.slice(0, start).trim();
  const after = text.slice(end + STRUCTURED_MARKER_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim();
  let structured: ProductionDayStructuredFields = {};
  try {
    const parsed = JSON.parse(jsonPayload) as ProductionDayStructuredFields;
    structured = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    structured = {};
  }
  return {
    plainNotes: plain || null,
    structured,
  };
}

export function composeShootDayNotes(
  plainNotes: string | null | undefined,
  structured: ProductionDayStructuredFields,
): string | null {
  const plain = normalizeText(plainNotes);
  const normalized: ProductionDayStructuredFields = {
    weather: normalizeText(structured.weather) || null,
    transportDetails: normalizeText(structured.transportDetails) || null,
    pickupDropoffInfo: normalizeText(structured.pickupDropoffInfo) || null,
    accommodation: normalizeText(structured.accommodation) || null,
    cateringNotes: normalizeText(structured.cateringNotes) || null,
    callSheetNotes: normalizeText(structured.callSheetNotes) || null,
  };
  const hasStructured = Object.values(normalized).some((v) => normalizeText(v) !== "");
  const blocks: string[] = [];
  if (plain) blocks.push(plain);
  if (hasStructured) {
    blocks.push(
      `${STRUCTURED_MARKER_START}\n${JSON.stringify(normalized)}\n${STRUCTURED_MARKER_END}`,
    );
  }
  const out = blocks.join("\n\n").trim();
  return out || null;
}

export async function buildProductionDataEngine(
  prisma: any,
  projectId: string,
  userId: string | null,
): Promise<ProductionDataEngineResult | null> {
  const project: any = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      scripts: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, title: true, _count: { select: { scenes: true } } },
      },
      scenes: {
        include: {
          primaryLocation: {
            include: {
              locationListing: {
                select: { id: true, name: true, rules: true, availability: true },
              },
            },
          },
          breakdownCharacters: { select: { id: true, name: true } },
          breakdownProps: { select: { id: true } },
          breakdownLocations: { select: { id: true, name: true } },
          breakdownWardrobes: { select: { id: true } },
          breakdownExtras: { select: { quantity: true } },
          breakdownVehicles: { select: { id: true, description: true } },
          breakdownStunts: { select: { id: true } },
          breakdownSfxs: { select: { id: true } },
        },
      },
      shootDays: {
        orderBy: { date: "asc" },
        include: {
          scenes: { orderBy: { order: "asc" }, select: { sceneId: true, order: true } },
        },
      },
      castingRoles: {
        include: {
          breakdownCharacter: { select: { id: true, name: true } },
          invitations: {
            where: { status: "ACCEPTED" },
            orderBy: { respondedAt: "desc" },
            include: { talent: true },
          },
        },
      },
      crewRoleNeeds: { orderBy: { createdAt: "asc" } },
      crewInvitations: {
        where: { status: "ACCEPTED" },
        include: { crewMember: true },
      },
      equipmentPlanItems: {
        include: {
          equipmentListing: {
            select: { id: true, companyName: true, category: true, description: true },
          },
        },
      },
    },
  });

  if (!project) return null;

  const castRoster = userId
    ? await prisma.creatorCastRoster.findMany({
        where: { creatorId: userId },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  const crewRoster = userId
    ? await prisma.creatorCrewRoster.findMany({
        where: { creatorId: userId },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const latestScript = project.scripts[0] ?? null;
  const scenes: any[] = project.scenes
    .slice()
    .sort((a: any, b: any) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }));
  const sceneById = new Map(scenes.map((s: any) => [s.id, s]));

  const castRoleByCharacterId = new Map(
    project.castingRoles
      .filter((role: any) => role.breakdownCharacterId)
      .map((role: any) => [role.breakdownCharacterId!, role]),
  );

  const equipmentAvailability = new Map<string, number>();
  for (const item of project.equipmentPlanItems) {
    const key = item.equipmentListing?.id ?? `category:${item.category.toLowerCase()}`;
    equipmentAvailability.set(key, (equipmentAvailability.get(key) ?? 0) + Math.max(1, item.quantity));
  }

  const productionDays: ProductionDayRecord[] = project.shootDays.map((day: any, index: number) => {
    const parsedNotes = parseShootDayNotes(day.dayNotes);
    const dayScenes = day.scenes
      .map((link: any) => {
        const scene = sceneById.get(link.sceneId);
        if (!scene) return null;
        return {
          sceneId: scene.id,
          order: link.order,
          number: scene.number,
          heading: scene.heading,
          description: scene.summary,
          estimatedShootDurationMinutes: buildSceneDurationMinutes(scene),
          source: scene,
        };
      })
      .filter((v: any): v is NonNullable<typeof v> => Boolean(v));

    const castMap = new Map<string, ProductionDayRecord["castRequired"][number]>();
    for (const s of dayScenes) {
      for (const ch of s.source.breakdownCharacters as any[]) {
        const role: any = castRoleByCharacterId.get(ch.id);
        const accepted = role?.invitations?.[0];
        const rosterMatch = castRoster.find((r: any) => r.name.toLowerCase() === (accepted?.talent?.name ?? "").toLowerCase());
        const key = role?.id ?? `character:${ch.id}`;
        if (!castMap.has(key)) {
          castMap.set(key, {
            key,
            name: accepted?.talent?.name ?? ch.name,
            roleOrCharacter: role?.name ?? ch.name,
            callTime: day.callTime,
            wrapTime: day.wrapTime,
            contactInfo: rosterMatch?.contactEmail ?? accepted?.talent?.contactEmail ?? null,
          });
        }
      }
    }

    const crewMap = new Map<string, ProductionDayRecord["crewRequired"][number]>();
    for (const need of project.crewRoleNeeds) {
      const linkedInvite = project.crewInvitations.find((inv: any) => inv.needId === need.id);
      const memberName = linkedInvite?.crewMember?.name ?? crewRoster.find((r: any) => (r.role ?? "").toLowerCase() === need.role.toLowerCase())?.name;
      const key = `need:${need.id}`;
      crewMap.set(key, {
        key,
        name: memberName ?? need.role,
        role: need.role,
        department: need.department ?? "Production",
        callTime: day.callTime,
        wrapTime: day.wrapTime,
      });
    }

    for (const s of dayScenes) {
      if (s.source.breakdownSfxs.length > 0 && ![...crewMap.values()].some((c) => c.department.toLowerCase().includes("sound"))) {
        crewMap.set(`auto:sound:${day.id}`, {
          key: `auto:sound:${day.id}`,
          name: "Sound Team",
          role: "Sound Mixer",
          department: "Sound",
          callTime: day.callTime,
          wrapTime: day.wrapTime,
        });
      }
      if (s.source.breakdownStunts.length > 0 && ![...crewMap.values()].some((c) => c.role.toLowerCase().includes("stunt"))) {
        crewMap.set(`auto:stunt:${day.id}`, {
          key: `auto:stunt:${day.id}`,
          name: "Stunt Coordinator",
          role: "Stunt Coordinator",
          department: "Safety",
          callTime: day.callTime,
          wrapTime: day.wrapTime,
        });
      }
    }

    const equipmentDemand = new Map<string, ProductionDayRecord["equipmentRequired"][number]>();
    for (const item of project.equipmentPlanItems) {
      const category = item.category || item.equipmentListing?.category || "General";
      const notesMeta = parseEmbeddedMeta<EquipmentMarketMeta>(item.notes);
      const listingMeta = parseEmbeddedMeta<EquipmentMarketMeta>(item.equipmentListing?.description ?? null);
      const name =
        item.description ||
        notesMeta.plain ||
        listingMeta.plain ||
        item.equipmentListing?.companyName ||
        `${category} kit`;
      const key = item.equipmentListing?.id ?? `category:${category.toLowerCase()}`;
      equipmentDemand.set(key, {
        key,
        equipmentName: name,
        category,
        quantity: Math.max(1, item.quantity),
        availability: notesMeta.meta?.availability ?? listingMeta.meta?.availability ?? null,
        specifications: notesMeta.meta?.specifications ?? listingMeta.meta?.specifications ?? null,
      });
    }
    for (const s of dayScenes) {
      if (s.source.breakdownSfxs.length > 0) {
        const key = "category:sound";
        const prev = equipmentDemand.get(key);
        equipmentDemand.set(key, {
          key,
          equipmentName: prev?.equipmentName ?? "Sound package",
          category: prev?.category ?? "Sound",
          quantity: (prev?.quantity ?? 1) + 1,
        });
      }
      if (s.source.breakdownStunts.length > 0) {
        const key = "category:safety";
        const prev = equipmentDemand.get(key);
        equipmentDemand.set(key, {
          key,
          equipmentName: prev?.equipmentName ?? "Safety / stunt rig",
          category: prev?.category ?? "Safety",
          quantity: (prev?.quantity ?? 1) + 1,
        });
      }
    }

    const locationFromScenes =
      dayScenes[0]?.source.primaryLocation?.name ??
      dayScenes[0]?.source.breakdownLocations[0]?.name ??
      null;
    const location = day.locationSummary ?? locationFromScenes;
    const locationRules = dayScenes[0]?.source.primaryLocation?.locationListing?.rules ?? null;
    const locationMeta = parseEmbeddedMeta<LocationMarketMeta>(locationRules);
    const notes = parsedNotes.plainNotes;
    const logistics = {
      transportDetails: parsedNotes.structured.transportDetails ?? null,
      pickupDropoffInfo: parsedNotes.structured.pickupDropoffInfo ?? null,
      accommodation: parsedNotes.structured.accommodation ?? null,
      cateringNotes: parsedNotes.structured.cateringNotes ?? null,
    };

    const callSheetOutput: ProductionDayRecord["callSheetOutput"] = {
      productionTitle: project.title,
      shootDayInfo: {
        date: day.date.toISOString(),
        shootDayNumber: index + 1,
        location,
        callTime: day.callTime,
        wrapTime: day.wrapTime,
        weather: parsedNotes.structured.weather ?? null,
      },
      sceneBreakdown: dayScenes.map((sc: any) => ({
        order: sc.order,
        sceneNumber: sc.number,
        heading: sc.heading,
        durationMinutes: sc.estimatedShootDurationMinutes,
      })),
      castCalls: [...castMap.values()].map((c) => ({
        name: c.name,
        role: c.roleOrCharacter,
        callTime: c.callTime,
        wrapTime: c.wrapTime,
        contactInfo: c.contactInfo,
      })),
      crewCalls: [...crewMap.values()].map((c) => ({
        name: c.name,
        role: c.role,
        department: c.department,
        callTime: c.callTime,
        wrapTime: c.wrapTime,
      })),
      equipmentList: [...equipmentDemand.values()].map((e) => ({
        name: e.equipmentName,
        category: e.category,
        quantity: e.quantity,
        availability: e.availability ?? null,
        specifications: e.specifications ?? null,
      })),
      notes:
        parsedNotes.structured.callSheetNotes ??
        [
          notes ?? null,
          locationMeta.meta?.restrictions ? `Location restrictions: ${locationMeta.meta.restrictions}` : null,
          locationMeta.meta?.permitNotes ? `Permit requirements: ${locationMeta.meta.permitNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      formats: {
        pdfExportReady: true,
        shareablePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${day.id}&view=share`,
        mobilePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${day.id}&view=mobile`,
      },
    };

    return {
      id: day.id,
      shootDayNumber: index + 1,
      date: day.date.toISOString(),
      callTime: day.callTime,
      wrapTime: day.wrapTime,
      location,
      weather: parsedNotes.structured.weather ?? null,
      notes,
      logistics,
      scenes: dayScenes.map((sc: any) => ({
        sceneId: sc.sceneId,
        order: sc.order,
        number: sc.number,
        heading: sc.heading,
        description: sc.description,
        estimatedShootDurationMinutes: sc.estimatedShootDurationMinutes,
      })),
      castRequired: [...castMap.values()],
      crewRequired: [...crewMap.values()],
      equipmentRequired: [...equipmentDemand.values()],
      callSheetOutput,
    };
  });

  const conflicts: ProductionConflict[] = [];

  for (const day of productionDays) {
    const callMins = parseTimeToMinutes(day.callTime);
    const wrapMins = parseTimeToMinutes(day.wrapTime);
    const dayDuration = callMins != null && wrapMins != null ? Math.max(0, wrapMins - callMins) : null;
    const required = day.scenes.reduce((acc, s) => acc + s.estimatedShootDurationMinutes, 0);
    if (day.scenes.length > 8 || (dayDuration != null && required > dayDuration)) {
      conflicts.push({
        type: "OVERLOADED_DAY",
        severity: "HIGH",
        message: `Shoot day ${day.shootDayNumber} is overloaded (${day.scenes.length} scenes, ~${required} min planned).`,
        dayIds: [day.id],
      });
    }
  }

  for (let i = 0; i < productionDays.length; i += 1) {
    for (let j = i + 1; j < productionDays.length; j += 1) {
      const a = productionDays[i];
      const b = productionDays[j];
      if (a.date.slice(0, 10) !== b.date.slice(0, 10)) continue;
      const overlap = overlaps(
        parseTimeToMinutes(a.callTime),
        parseTimeToMinutes(a.wrapTime),
        parseTimeToMinutes(b.callTime),
        parseTimeToMinutes(b.wrapTime),
      );
      if (!overlap) continue;

      const aCastKeys = new Set(a.castRequired.map((c) => c.key));
      const sharedCast = b.castRequired.filter((c) => aCastKeys.has(c.key));
      if (sharedCast.length > 0) {
        conflicts.push({
          type: "ACTOR_DOUBLE_BOOKING",
          severity: "HIGH",
          message: `Actor overlap on ${a.date.slice(0, 10)}: ${sharedCast.map((c) => c.name).join(", ")}.`,
          dayIds: [a.id, b.id],
        });
      }

      const aCrewKeys = new Set(a.crewRequired.map((c) => c.key));
      const sharedCrew = b.crewRequired.filter((c) => aCrewKeys.has(c.key));
      if (sharedCrew.length > 0) {
        conflicts.push({
          type: "CREW_OVERLAP",
          severity: "MEDIUM",
          message: `Crew overlap on ${a.date.slice(0, 10)}: ${sharedCrew.map((c) => c.role).join(", ")}.`,
          dayIds: [a.id, b.id],
        });
      }

      const demand = new Map<string, number>();
      for (const eq of a.equipmentRequired) demand.set(eq.key, (demand.get(eq.key) ?? 0) + eq.quantity);
      for (const eq of b.equipmentRequired) demand.set(eq.key, (demand.get(eq.key) ?? 0) + eq.quantity);
      for (const [key, qty] of demand) {
        const available = equipmentAvailability.get(key);
        if (available != null && qty > available) {
          conflicts.push({
            type: "EQUIPMENT_CONFLICT",
            severity: "MEDIUM",
            message: `Equipment conflict on ${a.date.slice(0, 10)} for ${key} (${qty} requested, ${available} available).`,
            dayIds: [a.id, b.id],
          });
        }
      }
    }
  }

  return {
    projectTitle: project.title,
    script: latestScript
      ? { id: latestScript.id, title: latestScript.title, sceneCount: latestScript._count.scenes }
      : null,
    scenes: scenes.map((scene: any) => ({
      id: scene.id,
      number: scene.number,
      heading: scene.heading,
      summary: scene.summary,
      status: scene.status,
      pageCount: scene.pageCount,
      callSheetTags: {
        castCount: scene.breakdownCharacters.length,
        locationCount:
          (scene.primaryLocation ? 1 : 0) + scene.breakdownLocations.length,
        propCount: scene.breakdownProps.length,
        equipmentHintCount: scene.breakdownVehicles.length + scene.breakdownSfxs.length,
        specialRequirementCount: scene.breakdownStunts.length + scene.breakdownSfxs.length,
      },
    })),
    productionDays,
    conflicts,
  };
}
