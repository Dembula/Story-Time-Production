/** Normalize actor/genre/theme names into stable graph ids. */
export function slugEntityId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function parseTagsList(tags: string | null | undefined): string[] {
  if (!tags?.trim()) return [];
  return tags
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseMoodThemes(moodTags: unknown): string[] {
  if (!Array.isArray(moodTags)) return [];
  return moodTags.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}
