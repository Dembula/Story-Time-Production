const OFFLINE_EXPENSE_KEY = (projectId: string) => `storytime-expense-offline-${projectId}`;

export type OfflineExpenseItem = {
  queuedAt: number;
  payload: Record<string, unknown>;
};

export function queueOfflineExpense(projectId: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(OFFLINE_EXPENSE_KEY(projectId));
    const arr: OfflineExpenseItem[] = raw ? JSON.parse(raw) : [];
    arr.push({ queuedAt: Date.now(), payload });
    localStorage.setItem(OFFLINE_EXPENSE_KEY(projectId), JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function getOfflineExpenseQueue(projectId: string): OfflineExpenseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_EXPENSE_KEY(projectId));
    return raw ? (JSON.parse(raw) as OfflineExpenseItem[]) : [];
  } catch {
    return [];
  }
}

export function setOfflineExpenseQueue(projectId: string, items: OfflineExpenseItem[]) {
  if (typeof window === "undefined") return;
  if (items.length) localStorage.setItem(OFFLINE_EXPENSE_KEY(projectId), JSON.stringify(items));
  else localStorage.removeItem(OFFLINE_EXPENSE_KEY(projectId));
}

export async function flushOfflineExpenseQueue(projectId: string): Promise<{ synced: number; remaining: number }> {
  const items = getOfflineExpenseQueue(projectId);
  if (!items.length) return { synced: 0, remaining: 0 };

  const remaining: OfflineExpenseItem[] = [];
  let synced = 0;

  for (const item of items) {
    try {
      const res = await fetch(`/api/creator/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item.payload, offlineSync: true }),
      });
      if (res.ok) synced++;
      else remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }

  setOfflineExpenseQueue(projectId, remaining);
  return { synced, remaining: remaining.length };
}

export function registerExpenseOfflineSync(projectId: string, onFlush?: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    void flushOfflineExpenseQueue(projectId).then(() => onFlush?.());
  };
  window.addEventListener("online", handler);
  handler();
  return () => window.removeEventListener("online", handler);
}
