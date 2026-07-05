/** Normalize a character name for identity matching (case-insensitive, collapsed space). */
export function normalizeCharacterName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export type CharacterRowLike = {
  id?: string;
  name?: string;
  description?: string | null;
  importance?: string | null;
  sceneId?: string | null;
};

/**
 * Collapse breakdown character rows so each (name, scene) pair appears once,
 * and identical names share the best metadata (importance / description).
 * Preserves one row per scene appearance for scene-level views, but never
 * treats the same person in two scenes as two different characters in metadata.
 */
export function consolidateCharacterRows<T extends CharacterRowLike>(rows: T[]): T[] {
  const byName = new Map<string, { importance: string | null; description: string | null; displayName: string }>();

  for (const row of rows) {
    const key = normalizeCharacterName(row.name);
    if (!key) continue;
    const prev = byName.get(key);
    const importance = row.importance?.trim() || null;
    const description = row.description?.trim() || null;
    if (!prev) {
      byName.set(key, {
        displayName: row.name!.replace(/\s+/g, " ").trim(),
        importance,
        description,
      });
      continue;
    }
    if (!prev.importance && importance) prev.importance = importance;
    if (!prev.description && description) prev.description = description;
    // Prefer title-case / longer display form
    const display = row.name!.replace(/\s+/g, " ").trim();
    if (display.length > prev.displayName.length) prev.displayName = display;
  }

  const seenScene = new Set<string>();
  const out: T[] = [];

  for (const row of rows) {
    const key = normalizeCharacterName(row.name);
    if (!key) {
      // Keep blank draft rows (user still typing a name)
      out.push(row);
      continue;
    }
    const sceneKey = `${key}::${row.sceneId ?? ""}`;
    if (seenScene.has(sceneKey)) continue;
    seenScene.add(sceneKey);

    const meta = byName.get(key)!;
    out.push({
      ...row,
      name: meta.displayName,
      importance: meta.importance,
      description: meta.description,
    });
  }

  return out;
}

/** Unique character count by identity (name), ignoring per-scene clones. */
export function uniqueCharacterCount(rows: CharacterRowLike[] | null | undefined): number {
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const key = normalizeCharacterName(row.name);
    if (key) seen.add(key);
  }
  return seen.size;
}

/**
 * For the characters list UI: one entry per identity when not filtering by scene.
 * `indices` are positions in the original array (all clones) for bulk update/remove.
 */
export function groupCharactersForDisplay<T extends CharacterRowLike>(
  rows: Array<{ row: T; idx: number }>,
): Array<{ row: T; idx: number; indices: number[]; sceneIds: string[] }> {
  const groups = new Map<string, { row: T; idx: number; indices: number[]; sceneIds: string[] }>();
  const blanks: Array<{ row: T; idx: number; indices: number[]; sceneIds: string[] }> = [];

  for (const item of rows) {
    const key = normalizeCharacterName(item.row.name);
    if (!key) {
      blanks.push({ row: item.row, idx: item.idx, indices: [item.idx], sceneIds: [] });
      continue;
    }
    const existing = groups.get(key);
    const sceneId = item.row.sceneId ?? null;
    if (!existing) {
      groups.set(key, {
        row: item.row,
        idx: item.idx,
        indices: [item.idx],
        sceneIds: sceneId ? [sceneId] : [],
      });
    } else {
      existing.indices.push(item.idx);
      if (sceneId && !existing.sceneIds.includes(sceneId)) existing.sceneIds.push(sceneId);
      // Prefer a row that has an id (persisted)
      if (!existing.row.id && item.row.id) {
        existing.row = item.row;
        existing.idx = item.idx;
      }
    }
  }

  return [...groups.values(), ...blanks];
}
