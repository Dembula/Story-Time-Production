/** Client-side shoot-day pipeline preview from draft selections (no save required). */

export type SchedulePreviewScene = {
  id: string;
  number: string;
  heading: string | null;
  breakdownCharacters: { name: string }[];
};

export type SchedulePreviewCrewNeed = {
  role: string;
  department: string;
};

export type SchedulePreviewEquipment = {
  category: string;
  description?: string | null;
  quantity: number;
};

export type ShootDayPipelinePreview = {
  unit: string | null;
  scenes: Array<{
    sceneId: string;
    order: number;
    number: string;
    heading: string | null;
    estimatedShootDurationMinutes: number;
  }>;
  castRequired: Array<{ key: string; name: string; roleOrCharacter: string }>;
  crewRequired: Array<{ key: string; role: string; department: string }>;
  equipmentRequired: Array<{ key: string; equipmentName: string; category: string; quantity: number }>;
};

export function buildShootDayPipelinePreview(input: {
  unit?: string | null;
  sceneLinks: Array<{ sceneId: string; order: number; scene?: SchedulePreviewScene | null }>;
  crewNeeds?: SchedulePreviewCrewNeed[];
  equipmentItems?: SchedulePreviewEquipment[];
}): ShootDayPipelinePreview {
  const ordered = input.sceneLinks.slice().sort((a, b) => a.order - b.order);
  const castMap = new Map<string, { name: string; roleOrCharacter: string }>();

  for (const link of ordered) {
    const sc = link.scene;
    if (!sc) continue;
    for (const c of sc.breakdownCharacters) {
      const name = c.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!castMap.has(key)) {
        castMap.set(key, { name, roleOrCharacter: `Character · Sc. ${sc.number}` });
      }
    }
  }

  const scenes = ordered
    .filter((l) => l.scene)
    .map((l) => ({
      sceneId: l.sceneId,
      order: l.order,
      number: l.scene!.number,
      heading: l.scene!.heading,
      estimatedShootDurationMinutes: Math.max(15, Math.round((l.scene!.heading?.length ?? 40) / 4) + 20),
    }));

  const crewRequired = (input.crewNeeds ?? []).map((c) => ({
    key: `${c.department}|${c.role}`.toLowerCase(),
    role: c.role,
    department: c.department,
  }));

  const equipmentRequired = (input.equipmentItems ?? []).map((e, i) => ({
    key: `eq-${i}-${e.category}`,
    equipmentName: e.description?.trim() || `${e.category} package`,
    category: e.category,
    quantity: e.quantity,
  }));

  const stuntBump = ordered.some((l) =>
    (l.scene?.heading ?? "").toLowerCase().includes("stunt"),
  );
  if (stuntBump && !equipmentRequired.some((e) => e.category.toLowerCase().includes("grip"))) {
    equipmentRequired.push({
      key: "eq-stunt-grip",
      equipmentName: "Grip / safety package",
      category: "Grip",
      quantity: 1,
    });
  }

  return {
    unit: input.unit ?? null,
    scenes,
    castRequired: [...castMap.entries()].map(([key, v]) => ({ key, ...v })),
    crewRequired,
    equipmentRequired,
  };
}
