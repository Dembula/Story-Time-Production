export const VISUAL_PLANNING_CATEGORY_IDS = [
  "edit",
  "colour",
  "art_direction",
  "location",
  "character",
  "moodboard",
  "tone_palette",
] as const;

export type VisualPlanningCategoryId = (typeof VISUAL_PLANNING_CATEGORY_IDS)[number];

/** Older category ids still present on saved assets — map into the current set. */
const LEGACY_VISUAL_CATEGORY_MAP: Record<string, VisualPlanningCategoryId> = {
  world_of_story: "art_direction",
  direction: "art_direction",
  scene: "edit",
  color: "colour",
  art: "art_direction",
  locations: "location",
  characters: "character",
  mood_board: "moodboard",
  tone: "tone_palette",
  palette: "tone_palette",
};

export const VISUAL_PLANNING_CATEGORIES: Array<{
  id: VisualPlanningCategoryId;
  label: string;
  blurb: string;
}> = [
  { id: "edit", label: "Edit", blurb: "Cut references, pacing, transitions, and editorial feel." },
  { id: "colour", label: "Colour", blurb: "Grade references, LUTs, and colour treatment." },
  { id: "art_direction", label: "Art direction", blurb: "Sets, props, design language, and visual world." },
  { id: "location", label: "Locations", blurb: "Real places, builds, and environment references." },
  { id: "character", label: "Characters", blurb: "Faces, wardrobe, hair — tied to cast and breakdown." },
  { id: "moodboard", label: "Mood board", blurb: "Look, lighting, and overall atmosphere." },
  { id: "tone_palette", label: "Tone & palette", blurb: "Emotional temperature and colour direction." },
];

export function isVisualPlanningCategory(id: string): id is VisualPlanningCategoryId {
  return (VISUAL_PLANNING_CATEGORY_IDS as readonly string[]).includes(id);
}

/** Accept current or legacy category ids; return the canonical id when known. */
export function normalizeVisualPlanningCategory(id: string): VisualPlanningCategoryId | null {
  if (isVisualPlanningCategory(id)) return id;
  return LEGACY_VISUAL_CATEGORY_MAP[id] ?? null;
}

export function visualPlanningCategoryLabel(id: string): string {
  const normalized = normalizeVisualPlanningCategory(id) ?? id;
  return VISUAL_PLANNING_CATEGORIES.find((c) => c.id === normalized)?.label ?? id;
}
