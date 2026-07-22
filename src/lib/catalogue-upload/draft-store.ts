import type { EpisodeDraft } from "@/components/creator/series-episodes-upload";

export type CatalogueUploadDraftSnapshot = {
  version: 1;
  tempId: string;
  contentId: string | null;
  step: number;
  form: Record<string, string>;
  selectedGenres: string[];
  crew: { name: string; role: string }[];
  btsVideos: { title: string; videoUrl: string }[];
  logline: string;
  contentWarnings: string;
  festivalHistory: string;
  minAge: number;
  advisoryFlags: Record<string, boolean>;
  advisoryThemes: string;
  deliveryNotes: string;
  releaseContactName: string;
  releaseContactEmail: string;
  releaseContactPhone: string;
  complianceChecks: Record<string, boolean>;
  seasonCount: number;
  episodesPerSeason: number[];
  episodeDrafts: EpisodeDraft[];
  dataSourceMode: string;
  linkedProjectId: string | null;
  linkedProjectTitle: string | null;
  platformScriptVersionId: string | null;
  scriptSource: string;
  scriptPreview: string | null;
  updatedAt: number;
};

function draftKey(userId: string, draftKeyId: string): string {
  return `catalogue-upload-draft:${userId}:${draftKeyId}`;
}

function activePointerKey(userId: string): string {
  return `catalogue-upload-draft-active:${userId}`;
}

export function saveCatalogueUploadDraft(
  userId: string,
  draftKeyId: string,
  snapshot: CatalogueUploadDraftSnapshot,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(draftKey(userId, draftKeyId), JSON.stringify(snapshot));
    if (snapshot.contentId && snapshot.contentId !== draftKeyId) {
      localStorage.setItem(draftKey(userId, snapshot.contentId), JSON.stringify(snapshot));
    }
    const pointer = snapshot.contentId || draftKeyId;
    localStorage.setItem(activePointerKey(userId), pointer);
  } catch {
    // Quota / private mode — ignore
  }
}

export function loadCatalogueUploadDraft(
  userId: string,
  draftKeyId: string,
): CatalogueUploadDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(userId, draftKeyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogueUploadDraftSnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Most recently saved draft for this user (survives temp-* key rotation on refresh). */
export function findLatestCatalogueUploadDraft(userId: string): CatalogueUploadDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  const prefix = `catalogue-upload-draft:${userId}:`;
  let best: CatalogueUploadDraftSnapshot | null = null;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CatalogueUploadDraftSnapshot;
      if (!parsed || parsed.version !== 1) continue;
      if (!best || (parsed.updatedAt ?? 0) > (best.updatedAt ?? 0)) best = parsed;
    }
    const activeId = localStorage.getItem(activePointerKey(userId));
    if (activeId) {
      const active = loadCatalogueUploadDraft(userId, activeId);
      if (active && (!best || (active.updatedAt ?? 0) >= (best.updatedAt ?? 0))) {
        return active;
      }
    }
  } catch {
    return best;
  }
  return best;
}

export function clearCatalogueUploadDraft(userId: string, draftKeyId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(userId, draftKeyId));
    const active = localStorage.getItem(activePointerKey(userId));
    if (active === draftKeyId) localStorage.removeItem(activePointerKey(userId));
  } catch {
    // ignore
  }
}

export function clearActiveCatalogueDraftPointer(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(activePointerKey(userId));
  } catch {
    // ignore
  }
}

export function newCatalogueDraftTempId(): string {
  return `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
