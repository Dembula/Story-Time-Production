/** Per-project preference for which budget version the creator is actively editing. */

const STORAGE_PREFIX = "storytime-active-budget:";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId.trim()}`;
}

export function getActiveBudgetId(projectId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !projectId?.trim()) return null;
  try {
    const value = window.localStorage.getItem(storageKey(projectId))?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function setActiveBudgetId(
  projectId: string | null | undefined,
  budgetId: string | null | undefined,
): void {
  if (typeof window === "undefined" || !projectId?.trim()) return;
  try {
    const id = budgetId?.trim();
    if (!id) {
      window.localStorage.removeItem(storageKey(projectId));
      return;
    }
    window.localStorage.setItem(storageKey(projectId), id);
    window.dispatchEvent(
      new CustomEvent("storytime:active-budget", {
        detail: { projectId: projectId.trim(), budgetId: id },
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
