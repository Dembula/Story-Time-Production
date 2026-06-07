const STORAGE_KEY = "storytime-breakdown-local-draft-v1";

export type LocalBreakdownDraft = {
  characters: Array<{ id?: string; name: string; sceneId?: string | null }>;
  props: Array<{ id?: string; name: string; description?: string | null; special?: boolean; sceneId?: string | null }>;
  locations: Array<{ id?: string; name: string; description?: string | null; sceneId?: string | null; locationListingId?: string | null }>;
  wardrobe: Array<{ id?: string; description: string; character?: string | null; sceneId?: string | null }>;
  extras: Array<{ id?: string; description: string; quantity?: number; sceneId?: string | null }>;
  vehicles: Array<{ id?: string; description: string; stuntRelated?: boolean; sceneId?: string | null }>;
  stunts: Array<{ id?: string; description: string; safetyNotes?: string | null; sceneId?: string | null }>;
  sfx: Array<{ id?: string; description: string; practical?: boolean; sceneId?: string | null }>;
  makeups: Array<{ id?: string; notes: string; character?: string | null; sceneId?: string | null }>;
  updatedAt: string;
};

export function emptyLocalBreakdownDraft(): Omit<LocalBreakdownDraft, "updatedAt"> {
  return {
    characters: [],
    props: [],
    locations: [],
    wardrobe: [],
    extras: [],
    vehicles: [],
    stunts: [],
    sfx: [],
    makeups: [],
  };
}

function read(): LocalBreakdownDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalBreakdownDraft;
  } catch {
    return null;
  }
}

export function getLocalBreakdownDraft(): LocalBreakdownDraft | null {
  return read();
}

export function saveLocalBreakdownDraft(
  draft: Omit<LocalBreakdownDraft, "updatedAt">,
): LocalBreakdownDraft {
  const next: LocalBreakdownDraft = { ...draft, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearLocalBreakdownDraft() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
