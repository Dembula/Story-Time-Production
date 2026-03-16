/**
 * MODOC per-section preferences (e.g. "decline MODOC for logline").
 * Stored in localStorage so the creator can turn off MODOC for specific fields.
 */

const STORAGE_KEY = "modoc_preferences";

export type ModocSection = "logline" | "idea_notes" | "script";

export interface ModocPreferences {
  /** true = user declined MODOC for this section (we still show "Get MODOC help" but don't auto-prompt) */
  declined?: Partial<Record<ModocSection, boolean>>;
}

function getStored(): ModocPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ModocPreferences;
    return parsed;
  } catch {
    return {};
  }
}

export function getModocDeclined(section: ModocSection): boolean {
  return getStored().declined?.[section] === true;
}

export function setModocDeclined(section: ModocSection, declined: boolean): void {
  if (typeof window === "undefined") return;
  const current = getStored();
  const declinedMap = { ...current.declined, [section]: declined };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, declined: declinedMap }));
}
