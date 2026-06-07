const STORAGE_KEY = "storytime-contract-local-drafts-v1";

export type LocalContractDraft = {
  id: string;
  templateType: string;
  resourceType: string;
  resourceId: string;
  subject: string;
  fields: Record<string, string>;
  templateBody: string;
  renderedPreview: string;
  updatedAt: string;
};

function readAll(): LocalContractDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalContractDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: LocalContractDraft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listLocalContractDrafts(): LocalContractDraft[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalContractDraft(id: string): LocalContractDraft | null {
  return readAll().find((d) => d.id === id) ?? null;
}

export function saveLocalContractDraft(draft: Omit<LocalContractDraft, "id" | "updatedAt"> & { id?: string }): LocalContractDraft {
  const all = readAll();
  const now = new Date().toISOString();
  const id = draft.id ?? `local-${Date.now()}`;
  const next: LocalContractDraft = {
    ...draft,
    id,
    updatedAt: now,
  };
  const idx = all.findIndex((d) => d.id === id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  return next;
}

export function deleteLocalContractDraft(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}
