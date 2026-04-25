export const VISUAL_PLANNING_CATEGORY_IDS = [
  "world_of_story",
  "moodboard",
  "tone_palette",
  "direction",
  "character",
  "location",
  "scene",
] as const;

export type VisualPlanningCategoryId = (typeof VISUAL_PLANNING_CATEGORY_IDS)[number];

export const VISUAL_PLANNING_CATEGORIES: Array<{
  id: VisualPlanningCategoryId;
  label: string;
  blurb: string;
}> = [
  { id: "world_of_story", label: "World of story", blurb: "Era, geography, social texture — what world we’re in." },
  { id: "moodboard", label: "Moodboard", blurb: "Look, color, lighting, and overall atmosphere." },
  { id: "tone_palette", label: "Tone & palette", blurb: "Emotional temperature and color direction." },
  { id: "direction", label: "Direction", blurb: "Framing, lens, movement, and director references." },
  { id: "character", label: "Characters", blurb: "Faces, wardrobe, hair — tied to your cast and breakdown." },
  { id: "location", label: "Locations", blurb: "Real places, builds, and environment references." },
  { id: "scene", label: "Scenes & shots", blurb: "Storyboard frames, key shots, and sequence beats." },
];

export function isVisualPlanningCategory(id: string): id is VisualPlanningCategoryId {
  return (VISUAL_PLANNING_CATEGORY_IDS as readonly string[]).includes(id);
}
