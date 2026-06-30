import type {
  BreakdownCategoryKey,
  BreakdownDepartmentId,
  CatalogAsset,
  ProductionInsight,
  SceneIntelligence,
} from "@/lib/breakdown/types";
import { CATEGORY_TO_DEPARTMENT, BREAKDOWN_DEPARTMENTS } from "@/lib/breakdown/departments";

type RawBreakdown = {
  characters: Array<{ id: string; name: string; description?: string | null; importance?: string | null; sceneId?: string | null }>;
  props: Array<{ id: string; name: string; description?: string | null; special?: boolean; sceneId?: string | null }>;
  locations: Array<{ id: string; name: string; description?: string | null; sceneId?: string | null; locationListingId?: string | null }>;
  wardrobe: Array<{ id: string; description: string; character?: string | null; sceneId?: string | null }>;
  extras: Array<{ id: string; description: string; quantity?: number; sceneId?: string | null }>;
  vehicles: Array<{ id: string; description: string; stuntRelated?: boolean; sceneId?: string | null }>;
  stunts: Array<{ id: string; description: string; safetyNotes?: string | null; sceneId?: string | null }>;
  sfx: Array<{ id: string; description: string; practical?: boolean; sceneId?: string | null }>;
  makeups: Array<{ id: string; notes: string; character?: string | null; sceneId?: string | null }>;
};

function sceneNumberMap(scenes: SceneIntelligence[]): Map<string, string> {
  return new Map(scenes.map((s) => [s.sceneId, s.sceneNumber]));
}

function mergeCatalogRow(
  map: Map<string, CatalogAsset>,
  key: string,
  asset: Omit<CatalogAsset, "sceneIds" | "sceneNumbers"> & { sceneId: string | null | undefined },
  numberBySceneId: Map<string, string>,
) {
  const existing = map.get(key);
  const sid = asset.sceneId ?? undefined;
  if (!existing) {
    map.set(key, {
      ...asset,
      sceneIds: sid ? [sid] : [],
      sceneNumbers: sid && numberBySceneId.get(sid) ? [numberBySceneId.get(sid)!] : [],
    });
    return;
  }
  if (sid && !existing.sceneIds.includes(sid)) {
    existing.sceneIds.push(sid);
    const num = numberBySceneId.get(sid);
    if (num && !existing.sceneNumbers.includes(num)) existing.sceneNumbers.push(num);
  }
}

export function buildProductionCatalog(
  raw: RawBreakdown,
  scenes: SceneIntelligence[],
): CatalogAsset[] {
  const numberBySceneId = sceneNumberMap(scenes);
  const map = new Map<string, CatalogAsset>();

  for (const c of raw.characters) {
    const label = c.name.trim();
    if (!label) continue;
    mergeCatalogRow(
      map,
      `characters:${label.toLowerCase()}`,
      {
        id: c.id,
        category: "characters",
        departmentId: CATEGORY_TO_DEPARTMENT.characters,
        label,
        description: c.description ?? null,
        meta: { importance: c.importance ?? null },
        sceneId: c.sceneId,
      },
      numberBySceneId,
    );
  }

  for (const p of raw.props) {
    const label = p.name.trim();
    if (!label) continue;
    mergeCatalogRow(
      map,
      `props:${label.toLowerCase()}`,
      {
        id: p.id,
        category: "props",
        departmentId: CATEGORY_TO_DEPARTMENT.props,
        label,
        description: p.description ?? null,
        meta: { special: p.special ?? false },
        sceneId: p.sceneId,
      },
      numberBySceneId,
    );
  }

  for (const l of raw.locations) {
    const label = l.name.trim();
    if (!label) continue;
    mergeCatalogRow(
      map,
      `locations:${label.toLowerCase()}`,
      {
        id: l.id,
        category: "locations",
        departmentId: CATEGORY_TO_DEPARTMENT.locations,
        label,
        description: l.description ?? null,
        meta: { locationListingId: l.locationListingId ?? null },
        sceneId: l.sceneId,
      },
      numberBySceneId,
    );
  }

  const simpleCategories: Array<{
    key: BreakdownCategoryKey;
    rows: Array<{ id: string; label: string; description: string | null; sceneId?: string | null; meta?: Record<string, unknown> }>;
  }> = [
    {
      key: "wardrobe",
      rows: raw.wardrobe.map((w) => ({
        id: w.id,
        label: w.character ? `${w.description} (${w.character})` : w.description,
        description: w.description,
        sceneId: w.sceneId,
        meta: { character: w.character ?? null },
      })),
    },
    {
      key: "extras",
      rows: raw.extras.map((e) => ({
        id: e.id,
        label: e.description,
        description: e.description,
        sceneId: e.sceneId,
        meta: { quantity: e.quantity ?? 1 },
      })),
    },
    {
      key: "vehicles",
      rows: raw.vehicles.map((v) => ({
        id: v.id,
        label: v.description,
        description: v.description,
        sceneId: v.sceneId,
        meta: { stuntRelated: v.stuntRelated ?? false },
      })),
    },
    {
      key: "stunts",
      rows: raw.stunts.map((s) => ({
        id: s.id,
        label: s.description,
        description: s.safetyNotes ?? s.description,
        sceneId: s.sceneId,
      })),
    },
    {
      key: "sfx",
      rows: raw.sfx.map((fx) => ({
        id: fx.id,
        label: fx.description,
        description: fx.description,
        sceneId: fx.sceneId,
        meta: { practical: fx.practical ?? false },
      })),
    },
    {
      key: "makeups",
      rows: raw.makeups.map((m) => ({
        id: m.id,
        label: m.character ? `${m.notes} (${m.character})` : m.notes,
        description: m.notes,
        sceneId: m.sceneId,
        meta: { character: m.character ?? null },
      })),
    },
  ];

  for (const { key, rows } of simpleCategories) {
    for (const row of rows) {
      const label = row.label.trim();
      if (!label) continue;
      mergeCatalogRow(
        map,
        `${key}:${label.toLowerCase()}`,
        {
          id: row.id,
          category: key,
          departmentId: CATEGORY_TO_DEPARTMENT[key],
          label,
          description: row.description,
          meta: row.meta,
          sceneId: row.sceneId,
        },
        numberBySceneId,
      );
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function generateProductionInsights(
  scenes: SceneIntelligence[],
  catalog: CatalogAsset[],
): ProductionInsight[] {
  const insights: ProductionInsight[] = [];
  let id = 0;
  const next = (partial: Omit<ProductionInsight, "id">) => {
    insights.push({ id: `insight-${++id}`, ...partial });
  };

  const locationAssets = catalog.filter((a) => a.category === "locations");
  for (const loc of locationAssets) {
    if (loc.sceneNumbers.length >= 3) {
      next({
        severity: "info",
        title: `"${loc.label}" spans ${loc.sceneNumbers.length} scenes`,
        body: "Consider block-shooting this location to reduce company moves and holding costs.",
        departmentIds: ["locations"],
        sceneNumbers: loc.sceneNumbers,
      });
    }
    if (loc.sceneNumbers.length === 1) {
      next({
        severity: "opportunity",
        title: `"${loc.label}" appears once`,
        body: "Single-use location — confirm if a simpler standing set or plate shot could substitute.",
        departmentIds: ["locations"],
        sceneNumbers: loc.sceneNumbers,
      });
    }
  }

  const castAssets = catalog.filter((a) => a.category === "characters");
  for (const cast of castAssets) {
    if (cast.sceneNumbers.length === 1) {
      next({
        severity: "opportunity",
        title: `${cast.label} is only needed for one scene`,
        body: "Consider scheduling this performer on a minimal day or as a one-day hire.",
        departmentIds: ["cast"],
        sceneNumbers: cast.sceneNumbers,
      });
    }
  }

  const highComplexity = scenes.filter((s) => s.complexityScore >= 60);
  if (highComplexity.length > 0) {
    next({
      severity: "warning",
      title: `${highComplexity.length} high-complexity scene${highComplexity.length === 1 ? "" : "s"}`,
      body: `Scenes ${highComplexity.map((s) => s.sceneNumber).join(", ")} may need extra prep time, safety review, and budget contingency.`,
      sceneNumbers: highComplexity.map((s) => s.sceneNumber),
    });
  }

  const extNight = scenes.filter((s) => s.intExt === "EXT" && s.timeOfDay === "NIGHT");
  if (extNight.length > 0) {
    next({
      severity: "warning",
      title: `${extNight.length} exterior night scene${extNight.length === 1 ? "" : "s"}`,
      body: "Exterior nights typically require lighting packages, weather contingency, and longer shoot hours.",
      departmentIds: ["camera_grip", "locations"],
      sceneNumbers: extNight.map((s) => s.sceneNumber),
    });
  }

  const stuntScenes = scenes.filter((s) => s.counts.stunts > 0);
  if (stuntScenes.length > 0) {
    next({
      severity: "warning",
      title: "Stunt sequences detected",
      body: "Coordinate stunt coordinator, safety medic, and insurance review before scheduling.",
      departmentIds: ["stunts", "safety_legal"],
      sceneNumbers: stuntScenes.map((s) => s.sceneNumber),
    });
  }

  const wardrobeByLabel = new Map<string, string[]>();
  for (const w of catalog.filter((a) => a.category === "wardrobe")) {
    const key = w.label.toLowerCase();
    wardrobeByLabel.set(key, [...(wardrobeByLabel.get(key) ?? []), ...w.sceneNumbers]);
  }
  for (const [label, nums] of wardrobeByLabel) {
    if (nums.length >= 3) {
      next({
        severity: "info",
        title: "Wardrobe continuity tracking recommended",
        body: `"${label}" appears in ${nums.length} scenes — flag for wardrobe continuity and daily photos.`,
        departmentIds: ["wardrobe"],
        sceneNumbers: [...new Set(nums)],
      });
    }
  }

  for (const scene of scenes) {
    for (const flag of scene.analysis?.aiFlags ?? []) {
      next({
        severity: /permit|insurance|legal|child|restricted/i.test(flag) ? "warning" : "info",
        title: `Scene ${scene.sceneNumber}: production note`,
        body: flag,
        sceneNumbers: [scene.sceneNumber],
      });
    }
  }

  return insights.slice(0, 24);
}

export function countByDepartment(catalog: CatalogAsset[]): Record<BreakdownDepartmentId, number> {
  const counts = Object.fromEntries(
    BREAKDOWN_DEPARTMENTS.map((d) => [d.id, 0]),
  ) as Record<BreakdownDepartmentId, number>;
  for (const asset of catalog) {
    counts[asset.departmentId] = (counts[asset.departmentId] ?? 0) + 1;
  }
  return counts;
}
