/** Client-side shoot-day pipeline preview from draft selections (no save required). */

export type SchedulePreviewScene = {
  id: string;
  number: string;
  heading: string | null;
  pageCount?: number | null;
  breakdownCharacters: { id?: string; name: string }[];
  breakdownProps?: { name: string; special?: boolean }[];
  breakdownVehicles?: { description: string; stuntRelated?: boolean }[];
  breakdownStunts?: { description: string }[];
  breakdownSfxs?: { description: string; practical?: boolean }[];
  breakdownExtras?: { description: string; quantity?: number }[];
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

export type SchedulePreviewCastingRole = {
  id: string;
  name: string;
  status?: string | null;
  breakdownCharacterId?: string | null;
  actorName?: string | null;
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
  crewRequired: Array<{ key: string; role: string; department: string; name?: string }>;
  equipmentRequired: Array<{ key: string; equipmentName: string; category: string; quantity: number }>;
};

export type SchedulePreviewSceneLink = {
  sceneId: string;
  order: number;
  scene?: SchedulePreviewScene | null;
};

/** Resolve scene links from picker ids or saved day links, hydrating full scene objects when possible. */
export function buildEffectiveSceneLinksForPreview(args: {
  scenePickerIds: string[];
  savedSceneLinks: Array<{ sceneId: string; order: number; scene?: SchedulePreviewScene | null }>;
  allScenes: SchedulePreviewScene[];
  /**
   * When true, an empty picker means no scenes (user cleared selection).
   * When false/omitted, fall back to saved links only if the picker is empty (initial load).
   */
  trustEmptyPicker?: boolean;
}): SchedulePreviewSceneLink[] {
  const sceneById = new Map(args.allScenes.map((s) => [s.id, s]));
  const savedById = new Map(
    args.savedSceneLinks.map((l) => [l.sceneId, l]),
  );

  const ids =
    args.trustEmptyPicker || args.scenePickerIds.length > 0
      ? args.scenePickerIds
      : args.savedSceneLinks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((l) => l.sceneId);

  return ids.map((sceneId, order) => {
    const saved = savedById.get(sceneId);
    const scene = sceneById.get(sceneId) ?? saved?.scene ?? null;
    return { sceneId, order, scene };
  });
}

function estimateSceneDurationMinutes(scene: SchedulePreviewScene): number {
  const pageFactor = Math.max(1, Number(scene.pageCount ?? 1));
  const base = Math.round(pageFactor * 50);
  const propPenalty = (scene.breakdownProps?.length ?? 0) * 4;
  const stuntPenalty = (scene.breakdownStunts?.length ?? 0) * 20;
  const sfxPenalty = (scene.breakdownSfxs?.length ?? 0) * 12;
  const extrasPenalty = (scene.breakdownExtras ?? []).reduce(
    (acc, e) => acc + Math.max(0, (e.quantity ?? 1) - 1) * 2,
    0,
  );
  return Math.max(30, base + propPenalty + stuntPenalty + sfxPenalty + extrasPenalty);
}

export function buildShootDayPipelinePreview(input: {
  unit?: string | null;
  sceneLinks: SchedulePreviewSceneLink[];
  crewNeeds?: SchedulePreviewCrewNeed[];
  equipmentItems?: SchedulePreviewEquipment[];
  castingRoles?: SchedulePreviewCastingRole[];
}): ShootDayPipelinePreview {
  const ordered = input.sceneLinks.slice().sort((a, b) => a.order - b.order);
  const castMap = new Map<string, { name: string; roleOrCharacter: string }>();

  const characterNamesOnDay = new Set<string>();
  const characterIdsOnDay = new Set<string>();

  for (const link of ordered) {
    const sc = link.scene;
    if (!sc) continue;
    for (const c of sc.breakdownCharacters ?? []) {
      const name = c.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      characterNamesOnDay.add(key);
      if (c.id) characterIdsOnDay.add(c.id);
      if (!castMap.has(key)) {
        castMap.set(key, { name, roleOrCharacter: `Character · Sc. ${sc.number}` });
      }
    }
  }

  const roleAppearsOnDay = (role: SchedulePreviewCastingRole): boolean => {
    const roleNameKey = role.name.trim().toLowerCase();
    if (!roleNameKey && !role.breakdownCharacterId) return false;
    if (role.breakdownCharacterId && characterIdsOnDay.has(role.breakdownCharacterId)) {
      return true;
    }
    if (roleNameKey && characterNamesOnDay.has(roleNameKey)) {
      return true;
    }
    return ordered.some((link) =>
      (link.scene?.breakdownCharacters ?? []).some(
        (c) =>
          (role.breakdownCharacterId && c.id === role.breakdownCharacterId) ||
          (roleNameKey && c.name.trim().toLowerCase() === roleNameKey),
      ),
    );
  };

  for (const role of input.castingRoles ?? []) {
    const roleNameKey = role.name.trim().toLowerCase();
    if (!roleNameKey && !role.breakdownCharacterId) continue;

    if (roleAppearsOnDay(role)) {
      const displayName = role.actorName?.trim() || role.name.trim();
      const mapKey = role.id || roleNameKey;
      castMap.set(mapKey, {
        name: displayName,
        roleOrCharacter: role.name.trim(),
      });
    }
  }

  if (castMap.size === 0 && ordered.length > 0) {
    for (const role of input.castingRoles ?? []) {
      const hasActor =
        role.status === "CAST" ||
        Boolean(role.actorName?.trim()) ||
        Boolean(role.name?.trim());
      if (!hasActor) continue;
      const displayName = role.actorName?.trim() || role.name.trim();
      castMap.set(role.id, {
        name: displayName,
        roleOrCharacter: role.name.trim(),
      });
    }
  }

  const scenes = ordered
    .filter((l) => l.scene)
    .map((l) => ({
      sceneId: l.sceneId,
      order: l.order,
      number: l.scene!.number,
      heading: l.scene!.heading,
      estimatedShootDurationMinutes: estimateSceneDurationMinutes(l.scene!),
    }));

  const crewMap = new Map<string, { key: string; role: string; department: string; name?: string }>();
  for (const c of input.crewNeeds ?? []) {
    const key = `${c.department}|${c.role}`.toLowerCase();
    crewMap.set(key, { key, role: c.role, department: c.department, name: c.role });
  }

  for (const link of ordered) {
    const sc = link.scene;
    if (!sc) continue;
    if ((sc.breakdownSfxs?.length ?? 0) > 0) {
      const key = "auto:sound";
      if (![...crewMap.values()].some((c) => c.department.toLowerCase().includes("sound"))) {
        crewMap.set(key, {
          key,
          role: "Sound Mixer",
          department: "Sound",
          name: "Sound Team",
        });
      }
    }
    if ((sc.breakdownStunts?.length ?? 0) > 0) {
      const key = "auto:stunt";
      if (![...crewMap.values()].some((c) => c.role.toLowerCase().includes("stunt"))) {
        crewMap.set(key, {
          key,
          role: "Stunt Coordinator",
          department: "Safety",
          name: "Stunt Coordinator",
        });
      }
    }
  }

  const equipmentMap = new Map<
    string,
    { key: string; equipmentName: string; category: string; quantity: number }
  >();

  for (const [i, e] of (input.equipmentItems ?? []).entries()) {
    const key = `plan-${i}-${e.category}`.toLowerCase();
    equipmentMap.set(key, {
      key,
      equipmentName: e.description?.trim() || `${e.category} package`,
      category: e.category,
      quantity: Math.max(1, e.quantity),
    });
  }

  for (const link of ordered) {
    const sc = link.scene;
    if (!sc) continue;

    for (const v of sc.breakdownVehicles ?? []) {
      const text = v.description.trim();
      if (!text) continue;
      const key = `vh:${text.toLowerCase()}`;
      equipmentMap.set(key, {
        key,
        equipmentName: text,
        category: v.stuntRelated ? "Transport / Stunt" : "Transport",
        quantity: 1,
      });
    }

    if ((sc.breakdownSfxs?.length ?? 0) > 0) {
      const key = "category:sound";
      const prev = equipmentMap.get(key);
      equipmentMap.set(key, {
        key,
        equipmentName: prev?.equipmentName ?? "Sound package",
        category: prev?.category ?? "Sound",
        quantity: (prev?.quantity ?? 0) + 1,
      });
    }

    if ((sc.breakdownStunts?.length ?? 0) > 0) {
      const key = "category:safety";
      const prev = equipmentMap.get(key);
      equipmentMap.set(key, {
        key,
        equipmentName: prev?.equipmentName ?? "Safety / stunt rig",
        category: prev?.category ?? "Safety",
        quantity: (prev?.quantity ?? 0) + 1,
      });
    }

    for (const p of sc.breakdownProps ?? []) {
      if (!p.special) continue;
      const name = p.name.trim();
      if (!name) continue;
      const key = `prop:${name.toLowerCase()}`;
      equipmentMap.set(key, {
        key,
        equipmentName: `${name} (special prop)`,
        category: "Props / Special",
        quantity: 1,
      });
    }
  }

  if (
    ordered.some((l) => (l.scene?.heading ?? "").toLowerCase().includes("stunt")) &&
    !equipmentMap.has("category:safety")
  ) {
    equipmentMap.set("category:safety", {
      key: "category:safety",
      equipmentName: "Grip / safety package",
      category: "Grip",
      quantity: 1,
    });
  }

  return {
    unit: input.unit ?? null,
    scenes,
    castRequired: [...castMap.entries()].map(([key, v]) => ({ key, ...v })),
    crewRequired: [...crewMap.values()],
    equipmentRequired: [...equipmentMap.values()],
  };
}
