import { parseSluglineMeta } from "@/lib/slugline-meta";

export const BUDGET_DEPARTMENTS = [
  "CAST",
  "CREW",
  "EQUIPMENT",
  "LOCATIONS",
  "ART_DEPARTMENT",
  "WARDROBE_MAKEUP",
  "SOUND",
  "POST_PRODUCTION",
  "TRANSPORT_LOGISTICS",
  "CATERING",
] as const;

export type BudgetDepartment = (typeof BUDGET_DEPARTMENTS)[number];

export type BudgetTemplate =
  | "SHORT_FILM"
  | "INDIE_FILM"
  | "FEATURE_FILM"
  | "TV_EPISODE"
  | "SERIES_PILOT"
  | "STUDENT_PRODUCTION"
  | "COMMERCIAL_SHOOT";

type TemplateConfig = {
  contingencyPct: number;
  baseDailyCrewRate: number;
  baseCastDayRate: number;
  postPerMinuteRate: number;
  cateringPerPersonPerDay: number;
  transportBasePerKm: number;
};

const TEMPLATE_CONFIG: Record<BudgetTemplate, TemplateConfig> = {
  SHORT_FILM: {
    contingencyPct: 0.1,
    baseDailyCrewRate: 1500,
    baseCastDayRate: 1200,
    postPerMinuteRate: 550,
    cateringPerPersonPerDay: 180,
    transportBasePerKm: 7,
  },
  INDIE_FILM: {
    contingencyPct: 0.12,
    baseDailyCrewRate: 1800,
    baseCastDayRate: 1600,
    postPerMinuteRate: 680,
    cateringPerPersonPerDay: 210,
    transportBasePerKm: 8,
  },
  FEATURE_FILM: {
    contingencyPct: 0.15,
    baseDailyCrewRate: 2400,
    baseCastDayRate: 2500,
    postPerMinuteRate: 900,
    cateringPerPersonPerDay: 260,
    transportBasePerKm: 9,
  },
  TV_EPISODE: {
    contingencyPct: 0.12,
    baseDailyCrewRate: 1900,
    baseCastDayRate: 1700,
    postPerMinuteRate: 700,
    cateringPerPersonPerDay: 220,
    transportBasePerKm: 8,
  },
  SERIES_PILOT: {
    contingencyPct: 0.14,
    baseDailyCrewRate: 2200,
    baseCastDayRate: 2100,
    postPerMinuteRate: 780,
    cateringPerPersonPerDay: 240,
    transportBasePerKm: 9,
  },
  STUDENT_PRODUCTION: {
    contingencyPct: 0.1,
    baseDailyCrewRate: 900,
    baseCastDayRate: 800,
    postPerMinuteRate: 300,
    cateringPerPersonPerDay: 120,
    transportBasePerKm: 5,
  },
  COMMERCIAL_SHOOT: {
    contingencyPct: 0.15,
    baseDailyCrewRate: 2500,
    baseCastDayRate: 2800,
    postPerMinuteRate: 1100,
    cateringPerPersonPerDay: 300,
    transportBasePerKm: 10,
  },
};

export type BudgetSceneInput = {
  id: string;
  number: string;
  heading: string | null;
  intExt: string | null;
  timeOfDay: string | null;
  pageCount: number | null;
  storyDay: number | null;
  primaryLocationName: string | null;
  locationDailyRate: number | null;
  locationRules: string | null;
  characters: Array<{ importance: string | null }>;
  propsCount: number;
  wardrobeCount: number;
  extrasCount: number;
  extrasQty: number;
  vehiclesCount: number;
  stuntsCount: number;
  sfxCount: number;
  makeupsCount: number;
  shootDaysAssigned: number;
};

export type BudgetManualLine = {
  department: string;
  name: string;
  quantity: number | null;
  unitCost: number | null;
  total: number | null;
};

export type BudgetExpenseLine = {
  amount: number;
  department: string | null;
};

export type BudgetCrewNeed = {
  department: string | null;
  role: string;
  seniority: string | null;
  notes: string | null;
};

export type BudgetCastRole = {
  name: string;
  status: string;
  linkedSalaryAmount: number | null;
};

export type BudgetEquipmentItem = {
  category: string;
  quantity: number;
  notes: string | null;
};

export type BudgetEngineInput = {
  template: BudgetTemplate;
  projectDurationMinutes: number | null;
  logisticsDistanceKm: number | null;
  scenes: BudgetSceneInput[];
  manualLines: BudgetManualLine[];
  expenses: BudgetExpenseLine[];
  crewNeeds: BudgetCrewNeed[];
  castRoles: BudgetCastRole[];
  equipmentItems: BudgetEquipmentItem[];
  shootDaysCount: number;
};

export type SceneBudgetLineItem = {
  key: string;
  sceneId: string;
  sceneNumber: string;
  sceneHeading: string | null;
  category: string;
  department: BudgetDepartment;
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
  notes: string;
};

export type BudgetEngineOutput = {
  dashboard: {
    estimatedTotal: number;
    actualSpend: number;
    variance: number;
    contingencyPercent: number;
    contingencyAllocation: number;
    costPerMinute: number;
    dailyBurnRate: number;
    shootDaysCount: number;
  };
  byDepartment: Array<{
    department: BudgetDepartment;
    estimated: number;
    actual: number;
    variance: number;
  }>;
  sceneSummaries: Array<{
    sceneId: string;
    sceneNumber: string;
    sceneHeading: string | null;
    estimatedTotal: number;
    durationDays: number;
    castCount: number;
    crewCount: number;
    isNight: boolean;
    locationName: string | null;
  }>;
  sceneLineItems: SceneBudgetLineItem[];
  optimizationSuggestions: string[];
  investorView: {
    totalCost: number;
    departmentBreakdown: Array<{ department: BudgetDepartment; estimated: number; sharePct: number }>;
    keyMetrics: {
      contingencyAllocation: number;
      costPerMinute: number;
      dailyBurnRate: number;
    };
  };
  templatePresets: Array<{
    template: BudgetTemplate;
    label: string;
    contingencyPct: number;
  }>;
};

function toNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDepartment(v: string | null | undefined): BudgetDepartment {
  const raw = (v ?? "").toUpperCase().replace(/\s+/g, "_").trim();
  if (raw.includes("CAST")) return "CAST";
  if (raw.includes("CREW")) return "CREW";
  if (raw.includes("EQUIP")) return "EQUIPMENT";
  if (raw.includes("LOCATION")) return "LOCATIONS";
  if (raw.includes("WARDROBE") || raw.includes("MAKEUP") || raw.includes("HAIR")) return "WARDROBE_MAKEUP";
  if (raw.includes("ART") || raw.includes("PROP") || raw.includes("SET")) return "ART_DEPARTMENT";
  if (raw.includes("SOUND")) return "SOUND";
  if (raw.includes("POST") || raw.includes("VFX") || raw.includes("EDIT")) return "POST_PRODUCTION";
  if (raw.includes("TRANSPORT") || raw.includes("LOGISTICS") || raw.includes("TRAVEL")) {
    return "TRANSPORT_LOGISTICS";
  }
  if (raw.includes("CATER")) return "CATERING";
  return "CREW";
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function clampMin(value: number, min = 0): number {
  return value < min ? min : value;
}

function parseRateFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const m =
    notes.match(/(?:rate|day[_\s-]?rate|daily)[=: ]\s*(\d+(?:\.\d+)?)/i) ??
    notes.match(/(\d+(?:\.\d+)?)\s*(?:zar|r)\b/i);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function sum<T>(arr: readonly T[], selector: (v: T) => number): number {
  return arr.reduce((acc, item) => acc + selector(item), 0);
}

export function runBudgetEngine(input: BudgetEngineInput): BudgetEngineOutput {
  const config = TEMPLATE_CONFIG[input.template] ?? TEMPLATE_CONFIG.SHORT_FILM;
  const departmentTotals: Record<BudgetDepartment, number> = {
    CAST: 0,
    CREW: 0,
    EQUIPMENT: 0,
    LOCATIONS: 0,
    ART_DEPARTMENT: 0,
    WARDROBE_MAKEUP: 0,
    SOUND: 0,
    POST_PRODUCTION: 0,
    TRANSPORT_LOGISTICS: 0,
    CATERING: 0,
  };
  const actualByDepartment: Record<BudgetDepartment, number> = {
    CAST: 0,
    CREW: 0,
    EQUIPMENT: 0,
    LOCATIONS: 0,
    ART_DEPARTMENT: 0,
    WARDROBE_MAKEUP: 0,
    SOUND: 0,
    POST_PRODUCTION: 0,
    TRANSPORT_LOGISTICS: 0,
    CATERING: 0,
  };

  for (const expense of input.expenses) {
    const department = normalizeDepartment(expense.department);
    actualByDepartment[department] += clampMin(toNumber(expense.amount));
  }

  const castRoleBaseRate =
    input.castRoles.length > 0
      ? safeDivide(
          sum(input.castRoles, (r) => toNumber(r.linkedSalaryAmount)),
          Math.max(1, input.castRoles.length),
        ) || config.baseCastDayRate
      : config.baseCastDayRate;
  const crewRateOverrides = input.crewNeeds
    .map((need) => parseRateFromNotes(need.notes))
    .filter((n): n is number => n != null);
  const crewBaseRate =
    crewRateOverrides.length > 0
      ? safeDivide(sum(crewRateOverrides, (n) => n), crewRateOverrides.length)
      : config.baseDailyCrewRate;
  const distanceKm = clampMin(toNumber(input.logisticsDistanceKm, 20));

  const equipmentRateByCategory = new Map<string, number>();
  for (const item of input.equipmentItems) {
    const overrideRate = parseRateFromNotes(item.notes);
    const category = item.category.toLowerCase();
    if (overrideRate != null) {
      equipmentRateByCategory.set(category, overrideRate);
    }
  }

  const sceneLineItems: SceneBudgetLineItem[] = [];
  const sceneSummaries: BudgetEngineOutput["sceneSummaries"] = [];
  const locationUsage = new Map<string, number>();
  let nightSceneCount = 0;
  let accumulatedCrewCount = 0;

  for (const scene of input.scenes) {
    const parsedFromHeading = parseSluglineMeta(scene.heading);
    const intExt = (scene.intExt ?? parsedFromHeading.intExt ?? "UNKNOWN").toUpperCase();
    const timeOfDay = (scene.timeOfDay ?? parsedFromHeading.timeOfDay ?? "UNKNOWN").toUpperCase();
    const isNight = timeOfDay === "NIGHT";
    if (isNight) nightSceneCount += 1;

    const assignedDays = clampMin(toNumber(scene.shootDaysAssigned, 0));
    const pageDerivedDays = Math.max(0.5, safeDivide(clampMin(toNumber(scene.pageCount, 1), 1), 4));
    const durationDays = assignedDays > 0 ? assignedDays : pageDerivedDays;
    const castCount = scene.characters.length + clampMin(toNumber(scene.extrasQty));
    const crewCount = Math.max(4, input.crewNeeds.length);
    accumulatedCrewCount += crewCount;

    const leadCount = scene.characters.filter((c) => (c.importance ?? "").toUpperCase() === "LEAD").length;
    const supportingCount = Math.max(0, scene.characters.length - leadCount);
    const castTotal =
      (leadCount * castRoleBaseRate * 1.3 + supportingCount * castRoleBaseRate + scene.extrasQty * 450) *
      durationDays;

    const crewComplexityFactor = 1 + scene.stuntsCount * 0.08 + scene.sfxCount * 0.05;
    const crewTotal = crewCount * crewBaseRate * durationDays * crewComplexityFactor;

    const equipmentUnits = Math.max(1, input.equipmentItems.length);
    const defaultEquipmentRate =
      intExt === "EXT" ? 1600 : 1400;
    const equipmentRate =
      safeDivide(
        input.equipmentItems.reduce((acc, item) => {
          const category = item.category.toLowerCase();
          const rate = equipmentRateByCategory.get(category) ?? defaultEquipmentRate;
          return acc + rate * Math.max(1, toNumber(item.quantity, 1));
        }, 0),
        equipmentUnits,
      ) || defaultEquipmentRate;
    const equipmentTotal = equipmentRate * equipmentUnits * durationDays;

    const permitCost = scene.locationRules?.toLowerCase().includes("permit") ? 1200 : 0;
    const locationRate = clampMin(toNumber(scene.locationDailyRate, intExt === "INT" ? 2200 : 2800));
    const locationNightSurcharge = isNight ? locationRate * 0.2 : 0;
    const locationTotal = locationRate * durationDays + permitCost + locationNightSurcharge;

    const artTotal = (scene.propsCount * 180 + scene.vehiclesCount * 300 + scene.extrasCount * 140) * durationDays;
    const wardrobeTotal = (scene.wardrobeCount * 260 + scene.makeupsCount * 240) * durationDays;

    const soundTotal = (900 + (isNight ? 250 : 0) + scene.sfxCount * 180) * durationDays;

    const transportTotal =
      (castCount + crewCount) * distanceKm * config.transportBasePerKm * durationDays;
    const cateringTotal = (castCount + crewCount) * config.cateringPerPersonPerDay * durationDays;

    const footageMinutes = Math.max(1.5, clampMin(toNumber(scene.pageCount, 1), 1) * 0.9);
    const complexityMultiplier = 1 + scene.stuntsCount * 0.12 + scene.sfxCount * 0.14;
    const postTotal = footageMinutes * config.postPerMinuteRate * complexityMultiplier;

    const bySceneDepartment: Array<{ department: BudgetDepartment; total: number; name: string; quantity: number; unitCost: number; category: string; notes: string }> =
      [
        {
          department: "CAST",
          total: castTotal,
          name: "Cast allocation",
          quantity: Math.max(1, castCount),
          unitCost: safeDivide(castTotal, Math.max(1, castCount)),
          category: "CAST",
          notes: `Lead ${leadCount}, supporting ${supportingCount}, extras ${scene.extrasQty}`,
        },
        {
          department: "CREW",
          total: crewTotal,
          name: "Crew allocation",
          quantity: crewCount,
          unitCost: safeDivide(crewTotal, crewCount),
          category: "CREW",
          notes: `Complexity factor ${crewComplexityFactor.toFixed(2)}`,
        },
        {
          department: "EQUIPMENT",
          total: equipmentTotal,
          name: "Equipment rental",
          quantity: equipmentUnits,
          unitCost: safeDivide(equipmentTotal, equipmentUnits),
          category: "EQUIPMENT",
          notes: `Duration ${durationDays.toFixed(1)} day(s)`,
        },
        {
          department: "LOCATIONS",
          total: locationTotal,
          name: "Location and permits",
          quantity: Math.max(1, durationDays),
          unitCost: safeDivide(locationTotal, Math.max(1, durationDays)),
          category: "LOCATION",
          notes: scene.primaryLocationName ?? "Unassigned location",
        },
        {
          department: "ART_DEPARTMENT",
          total: artTotal,
          name: "Props and set dressing",
          quantity: Math.max(1, scene.propsCount + scene.vehiclesCount),
          unitCost: safeDivide(artTotal, Math.max(1, scene.propsCount + scene.vehiclesCount)),
          category: "ART",
          notes: `${scene.propsCount} props, ${scene.vehiclesCount} vehicles`,
        },
        {
          department: "WARDROBE_MAKEUP",
          total: wardrobeTotal,
          name: "Wardrobe and makeup",
          quantity: Math.max(1, scene.wardrobeCount + scene.makeupsCount),
          unitCost: safeDivide(wardrobeTotal, Math.max(1, scene.wardrobeCount + scene.makeupsCount)),
          category: "WARDROBE_MAKEUP",
          notes: `${scene.wardrobeCount} wardrobe, ${scene.makeupsCount} makeup`,
        },
        {
          department: "SOUND",
          total: soundTotal,
          name: "Sound capture",
          quantity: 1,
          unitCost: soundTotal,
          category: "SOUND",
          notes: isNight ? "Night shoot surcharge applied" : "Standard scene sound package",
        },
        {
          department: "TRANSPORT_LOGISTICS",
          total: transportTotal,
          name: "Transport and logistics",
          quantity: Math.max(1, castCount + crewCount),
          unitCost: safeDivide(transportTotal, Math.max(1, castCount + crewCount)),
          category: "LOGISTICS",
          notes: `Distance ${distanceKm.toFixed(1)} km`,
        },
        {
          department: "CATERING",
          total: cateringTotal,
          name: "Catering",
          quantity: Math.max(1, castCount + crewCount),
          unitCost: safeDivide(cateringTotal, Math.max(1, castCount + crewCount)),
          category: "CATERING",
          notes: `${Math.max(1, castCount + crewCount)} pax`,
        },
        {
          department: "POST_PRODUCTION",
          total: postTotal,
          name: "Post production allocation",
          quantity: Number(footageMinutes.toFixed(2)),
          unitCost: config.postPerMinuteRate * complexityMultiplier,
          category: "POST",
          notes: `Complexity multiplier ${complexityMultiplier.toFixed(2)}`,
        },
      ];

    const sceneTotal = sum(bySceneDepartment, (row) => row.total);
    const locationKey = (scene.primaryLocationName ?? "unknown").toLowerCase().trim();
    locationUsage.set(locationKey, (locationUsage.get(locationKey) ?? 0) + 1);

    for (const row of bySceneDepartment) {
      const total = clampMin(toNumber(row.total));
      departmentTotals[row.department] += total;
      sceneLineItems.push({
        key: `${scene.id}:${row.department}:${row.name}`.toLowerCase(),
        sceneId: scene.id,
        sceneNumber: scene.number,
        sceneHeading: scene.heading,
        category: row.category,
        department: row.department,
        name: row.name,
        quantity: Number(row.quantity.toFixed(2)),
        unitCost: Number(row.unitCost.toFixed(2)),
        total: Number(total.toFixed(2)),
        notes: row.notes,
      });
    }

    sceneSummaries.push({
      sceneId: scene.id,
      sceneNumber: scene.number,
      sceneHeading: scene.heading,
      estimatedTotal: Number(sceneTotal.toFixed(2)),
      durationDays: Number(durationDays.toFixed(2)),
      castCount: Math.max(1, castCount),
      crewCount,
      isNight,
      locationName: scene.primaryLocationName,
    });
  }

  for (const line of input.manualLines) {
    const dep = normalizeDepartment(line.department);
    const total = line.total ?? (toNumber(line.quantity, 1) * toNumber(line.unitCost, 0));
    departmentTotals[dep] += clampMin(toNumber(total));
  }

  const estimatedTotal = sum(BUDGET_DEPARTMENTS, (d) => departmentTotals[d]);
  const actualSpend = sum(input.expenses, (e) => clampMin(toNumber(e.amount)));
  const variance = estimatedTotal - actualSpend;
  const contingencyAllocation = estimatedTotal * config.contingencyPct;
  const derivedDurationMinutes = input.projectDurationMinutes ?? Math.max(10, input.scenes.length * 2.5);
  const costPerMinute = safeDivide(estimatedTotal, derivedDurationMinutes);
  const shootDaysCount = input.shootDaysCount > 0 ? input.shootDaysCount : Math.max(1, input.scenes.length);
  const dailyBurnRate = safeDivide(estimatedTotal, shootDaysCount);

  const byDepartment = BUDGET_DEPARTMENTS.map((department) => {
    const estimated = departmentTotals[department];
    const actual = actualByDepartment[department];
    return {
      department,
      estimated: Number(estimated.toFixed(2)),
      actual: Number(actual.toFixed(2)),
      variance: Number((estimated - actual).toFixed(2)),
    };
  });

  const optimizationSuggestions: string[] = [];
  const repeatedLocations = [...locationUsage.entries()].filter(([name, count]) => name !== "unknown" && count > 1);
  if (repeatedLocations.length > 0) {
    const top = repeatedLocations.sort((a, b) => b[1] - a[1])[0];
    optimizationSuggestions.push(
      `Batch scenes at ${top[0]}: ${top[1]} scenes share this location and can reduce travel and setup costs.`,
    );
  }
  if (nightSceneCount > Math.ceil(input.scenes.length * 0.3)) {
    optimizationSuggestions.push(
      "Night scenes are above 30% of the schedule; moving some to day can reduce lighting, transport, and overtime costs.",
    );
  }
  const avgCrewPerScene = safeDivide(accumulatedCrewCount, Math.max(1, input.scenes.length));
  if (avgCrewPerScene > 10) {
    optimizationSuggestions.push(
      "Average crew per scene is high; consider leaner crew assignments for low-complexity scenes to reduce burn rate.",
    );
  }
  const logisticsShare = safeDivide(departmentTotals.TRANSPORT_LOGISTICS, Math.max(1, estimatedTotal));
  if (logisticsShare > 0.12) {
    optimizationSuggestions.push(
      "Transport and logistics exceed 12% of the estimate; consider tighter location clustering and pooled transport.",
    );
  }
  if (optimizationSuggestions.length === 0) {
    optimizationSuggestions.push(
      "Budget distribution is balanced; keep updating rates and actual expenses to maintain forecasting accuracy.",
    );
  }

  const investorViewBreakdown = byDepartment
    .map((d) => ({
      department: d.department,
      estimated: d.estimated,
      sharePct: Number((safeDivide(d.estimated, Math.max(1, estimatedTotal)) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.estimated - a.estimated);

  return {
    dashboard: {
      estimatedTotal: Number(estimatedTotal.toFixed(2)),
      actualSpend: Number(actualSpend.toFixed(2)),
      variance: Number(variance.toFixed(2)),
      contingencyPercent: config.contingencyPct,
      contingencyAllocation: Number(contingencyAllocation.toFixed(2)),
      costPerMinute: Number(costPerMinute.toFixed(2)),
      dailyBurnRate: Number(dailyBurnRate.toFixed(2)),
      shootDaysCount,
    },
    byDepartment,
    sceneSummaries,
    sceneLineItems,
    optimizationSuggestions,
    investorView: {
      totalCost: Number(estimatedTotal.toFixed(2)),
      departmentBreakdown: investorViewBreakdown,
      keyMetrics: {
        contingencyAllocation: Number(contingencyAllocation.toFixed(2)),
        costPerMinute: Number(costPerMinute.toFixed(2)),
        dailyBurnRate: Number(dailyBurnRate.toFixed(2)),
      },
    },
    templatePresets: (Object.keys(TEMPLATE_CONFIG) as BudgetTemplate[]).map((template) => ({
      template,
      label: template
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      contingencyPct: TEMPLATE_CONFIG[template].contingencyPct,
    })),
  };
}
