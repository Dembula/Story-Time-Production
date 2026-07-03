/** Client-side preference for the creator's active/default project across tools. */

export const ACTIVE_PROJECT_STORAGE_KEY = "storytime-active-project-id";

export type ProjectListItem = {
  id: string;
  title: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function setActiveProjectId(projectId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const id = projectId?.trim();
    if (!id) {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
    window.dispatchEvent(
      new CustomEvent("storytime:active-project", { detail: { projectId: id } }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearActiveProjectId(): void {
  setActiveProjectId(null);
}

function timestamp(value: string | Date | undefined): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Newest project first (createdAt, then updatedAt). */
export function sortProjectsNewestFirst<T extends ProjectListItem>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const createdDiff = timestamp(b.createdAt) - timestamp(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return timestamp(b.updatedAt) - timestamp(a.updatedAt);
  });
}

/**
 * Active/default project for tools:
 * 1) stored preference if still in the list
 * 2) otherwise the most recently created project
 */
export function resolveDefaultProjectId<T extends ProjectListItem>(
  projects: T[],
  preferredId?: string | null,
): string | null {
  if (!projects.length) return null;
  const preferred = preferredId?.trim() || getActiveProjectId();
  if (preferred && projects.some((p) => p.id === preferred)) return preferred;
  return sortProjectsNewestFirst(projects)[0]?.id ?? null;
}

/** Active project first, then newest created. */
export function sortProjectsWithActiveFirst<T extends ProjectListItem>(
  projects: T[],
  activeId?: string | null,
): T[] {
  const active = activeId?.trim() || getActiveProjectId();
  const newest = sortProjectsNewestFirst(projects);
  if (!active) return newest;
  const selected = newest.find((p) => p.id === active);
  if (!selected) return newest;
  return [selected, ...newest.filter((p) => p.id !== active)];
}
