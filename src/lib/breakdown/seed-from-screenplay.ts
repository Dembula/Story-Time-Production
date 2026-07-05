/**
 * Deterministic breakdown seeding from screenplay text.
 * Links characters and locations to project scenes without AI.
 */

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|INT\/EXT\.|I\/E\.|EST\.)/i;

const CHARACTER_LINE = /^[A-Z][A-Z0-9 .'\-()]{1,38}$/;

const TRANSITIONS = /^(FADE|CUT|DISSOLVE|MONTAGE|INTERCUT|SMASH|MATCH|WIPE|CONTINUED)/i;

export type SeedScene = {
  id: string;
  number: string;
  heading: string | null;
};

export type SeededBreakdown = {
  characters: Array<{ name: string; sceneId: string; importance?: string | null; description?: string | null }>;
  locations: Array<{ name: string; sceneId: string; description?: string | null }>;
};

function normalizeHeading(heading: string | null | undefined): string {
  return (heading ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

function locationFromHeading(heading: string | null | undefined): string | null {
  if (!heading?.trim()) return null;
  let loc = heading.trim();
  loc = loc.replace(/^(INT\.\/EXT\.|EXT\.\/INT\.|INT\/EXT\.|I\/E\.|INT\.|EXT\.|EST\.)\s*/i, "");
  loc = loc.replace(/\s*[-–—]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|CONTINUOUS|LATER|SAME)\s*\.?$/i, "");
  loc = loc.replace(/\s+/g, " ").trim();
  return loc || null;
}

function isCharacterCue(line: string, nextLine: string): string | null {
  const trimmed = line.trim();
  const name = trimmed.replace(/\s*\((V\.O\.?|O\.S\.?|CONT'D|CONT’D)\)\s*$/i, "").trim();
  if (!name || !CHARACTER_LINE.test(name)) return null;
  if (SCENE_HEADING.test(name)) return null;
  if (TRANSITIONS.test(name)) return null;
  if (name.length < 2) return null;

  const next = nextLine.trim();
  if (!next) return null;
  if (SCENE_HEADING.test(next)) return null;
  // Dialogue or parenthetical after cue
  if (next.startsWith("(") || /^[A-Za-z"'“]/.test(next)) return name;
  return null;
}

type ScriptSceneBlock = {
  number: number;
  heading: string;
  lines: string[];
};

function splitScreenplayIntoScenes(content: string): ScriptSceneBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ScriptSceneBlock[] = [];
  let current: ScriptSceneBlock | null = null;
  let n = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (SCENE_HEADING.test(trimmed)) {
      n += 1;
      current = { number: n, heading: trimmed, lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  return blocks;
}

function charactersInBlock(block: ScriptSceneBlock): string[] {
  const names = new Set<string>();
  for (let i = 0; i < block.lines.length; i += 1) {
    const cue = isCharacterCue(block.lines[i] ?? "", block.lines[i + 1] ?? "");
    if (cue) names.add(cue);
  }
  return [...names];
}

/**
 * Build per-scene character and location rows from screenplay text,
 * matched to existing project scenes by number or heading.
 */
export function seedBreakdownFromScreenplay(
  content: string,
  projectScenes: SeedScene[],
): SeededBreakdown {
  const characters: SeededBreakdown["characters"] = [];
  const locations: SeededBreakdown["locations"] = [];
  if (!content.trim() || projectScenes.length === 0) {
    return { characters, locations };
  }

  const blocks = splitScreenplayIntoScenes(content);
  const byNumber = new Map(projectScenes.map((s) => [String(s.number).trim(), s]));
  const byHeading = new Map(
    projectScenes
      .filter((s) => s.heading?.trim())
      .map((s) => [normalizeHeading(s.heading), s]),
  );

  const usedSceneIds = new Set<string>();

  for (const block of blocks) {
    const byNum = byNumber.get(String(block.number));
    const byHead = byHeading.get(normalizeHeading(block.heading));
    const scene = byNum ?? byHead;
    if (!scene || usedSceneIds.has(scene.id)) continue;
    usedSceneIds.add(scene.id);

    const loc =
      locationFromHeading(scene.heading) ?? locationFromHeading(block.heading);
    if (loc) {
      locations.push({ name: loc, sceneId: scene.id, description: null });
    }

    for (const name of charactersInBlock(block)) {
      characters.push({
        name,
        sceneId: scene.id,
        importance: null,
        description: null,
      });
    }
  }

  // Any project scenes not matched by block order still get a location from their heading.
  for (const scene of projectScenes) {
    if (usedSceneIds.has(scene.id)) continue;
    const loc = locationFromHeading(scene.heading);
    if (loc) locations.push({ name: loc, sceneId: scene.id, description: null });
  }

  return { characters, locations };
}

type NamedRow = { name?: string; sceneId?: string | null };
type LocRow = { name?: string; sceneId?: string | null };

/** Merge seeded rows into an existing draft without duplicating name+sceneId pairs. */
export function mergeSeededBreakdownIntoDraft<
  T extends {
    characters?: NamedRow[];
    locations?: LocRow[];
    [key: string]: unknown;
  },
>(draft: T, seeded: SeededBreakdown): { draft: T; added: number } {
  let added = 0;
  const next = { ...draft } as T;

  // Same person in multiple scenes = one identity; at most one row per (name, scene).
  const existingChars = new Set(
    (draft.characters ?? [])
      .filter((r) => r.name?.trim())
      .map((r) => `${r.sceneId ?? ""}::${r.name!.trim().toUpperCase()}`),
  );
  const characters = [...(draft.characters ?? [])];
  for (const row of seeded.characters) {
    const key = `${row.sceneId}::${row.name.trim().toUpperCase()}`;
    if (existingChars.has(key)) continue;
    existingChars.add(key);
    characters.push(row);
    added += 1;
  }
  next.characters = characters as T["characters"];

  const existingLocs = new Set(
    (draft.locations ?? [])
      .filter((r) => r.sceneId && r.name?.trim())
      .map((r) => `${r.sceneId}::${r.name!.trim().toUpperCase()}`),
  );
  const locations = [...(draft.locations ?? [])];
  for (const row of seeded.locations) {
    const key = `${row.sceneId}::${row.name.trim().toUpperCase()}`;
    if (existingLocs.has(key)) continue;
    existingLocs.add(key);
    locations.push(row);
    added += 1;
  }
  next.locations = locations as T["locations"];

  return { draft: next, added };
}

/** True when no breakdown rows are linked to any scene. */
export function draftHasNoSceneLinkedItems(draft: {
  characters?: Array<{ sceneId?: string | null }>;
  props?: Array<{ sceneId?: string | null }>;
  locations?: Array<{ sceneId?: string | null }>;
  wardrobe?: Array<{ sceneId?: string | null }>;
  extras?: Array<{ sceneId?: string | null }>;
  vehicles?: Array<{ sceneId?: string | null }>;
  stunts?: Array<{ sceneId?: string | null }>;
  sfx?: Array<{ sceneId?: string | null }>;
  makeups?: Array<{ sceneId?: string | null }>;
}): boolean {
  const buckets = [
    draft.characters,
    draft.props,
    draft.locations,
    draft.wardrobe,
    draft.extras,
    draft.vehicles,
    draft.stunts,
    draft.sfx,
    draft.makeups,
  ];
  return !buckets.some((rows) => (rows ?? []).some((r) => Boolean(r.sceneId)));
}
