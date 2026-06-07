import type { BudgetEngineOutput, BudgetTemplate } from "@/lib/budget-engine";

const STORAGE_KEY = "storytime-budget-local-draft-v1";

export type LocalBudgetLine = {
  id?: string;
  department: string;
  name: string;
  quantity: number | null;
  unitCost: number | null;
  total: number | null;
  notes: string | null;
};

export type LocalBudgetDraft = {
  template: BudgetTemplate;
  lines: LocalBudgetLine[];
  engine: BudgetEngineOutput;
  updatedAt: string;
};

function read(): LocalBudgetDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalBudgetDraft;
  } catch {
    return null;
  }
}

export function getLocalBudgetDraft(): LocalBudgetDraft | null {
  return read();
}

export function saveLocalBudgetDraft(draft: Omit<LocalBudgetDraft, "updatedAt">): LocalBudgetDraft {
  const next: LocalBudgetDraft = { ...draft, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearLocalBudgetDraft() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
