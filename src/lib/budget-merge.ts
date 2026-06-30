import {
  budgetRowKey,
  dedupeBudgetRowsByKey,
  extractBudgetLineKey,
  isEngineSceneAllocationLine,
  stripBudgetLineKey,
} from "@/lib/budget-line-keys";

export type MergeableBudgetRow = {
  id?: string;
  key: string;
  department: string;
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
  notes: string;
  sceneId: string | null;
  sceneNumber: string | null;
  sceneHeading: string | null;
  category: string;
};

type SavedLine = {
  id: string;
  department: string;
  name: string;
  quantity: number | null;
  unitCost: number | null;
  total: number | null;
  notes: string | null;
};

function calcTotal(quantity: number, unitCost: number): number {
  return Math.max(0, quantity) * Math.max(0, unitCost);
}

/**
 * Merge engine/breakdown template rows with persisted DB lines without duplicating.
 * Saved scene allocations that match engine keys update amounts; unmatched saved rows stay as manual.
 */
export function mergeBudgetTemplateWithSaved(
  template: MergeableBudgetRow[],
  savedLines: SavedLine[],
): MergeableBudgetRow[] {
  const savedByKey = new Map<string, SavedLine>();
  for (const line of savedLines) {
    const key = extractBudgetLineKey(line.notes, {
      id: line.id,
      department: line.department,
      name: line.name,
    });
    savedByKey.set(key, line);
    savedByKey.set(`${line.department}|${line.name}`.toLowerCase(), line);
  }

  const templateKeys = new Set<string>();
  const merged = template.map((row) => {
    const lookupKey = budgetRowKey(row);
    templateKeys.add(lookupKey);
    const fromSaved =
      savedByKey.get(lookupKey) ??
      savedByKey.get(`${row.department}|${row.name}`.toLowerCase());
    if (!fromSaved) return row;
    const qty = Number(fromSaved.quantity ?? row.quantity ?? 1);
    const unit = Number(fromSaved.unitCost ?? row.unitCost ?? 0);
    return {
      ...row,
      id: fromSaved.id,
      key: lookupKey,
      quantity: qty,
      unitCost: unit,
      notes: stripBudgetLineKey(fromSaved.notes) || row.notes,
      total: calcTotal(qty, unit),
    };
  });

  const manualRows: MergeableBudgetRow[] = [];
  for (const line of savedLines) {
    const key = extractBudgetLineKey(line.notes, {
      id: line.id,
      department: line.department,
      name: line.name,
    });
    if (templateKeys.has(key)) continue;
    if (
      isEngineSceneAllocationLine(line.name) &&
      !line.notes?.includes("[ST_BUDGET_KEY]")
    ) {
      continue;
    }
    const legacyKey = `${line.department}|${line.name}`.toLowerCase();
    if (templateKeys.has(legacyKey)) continue;

    manualRows.push({
      id: line.id,
      key: key || `manual|${line.id}`,
      department: line.department,
      name: line.name,
      quantity: Number(line.quantity ?? 1),
      unitCost: Number(line.unitCost ?? 0),
      total: Number(line.total ?? 0),
      notes: stripBudgetLineKey(line.notes),
      sceneId: null,
      sceneNumber: null,
      sceneHeading: null,
      category: "MANUAL",
    });
  }

  return dedupeBudgetRowsByKey([...merged, ...manualRows]);
}
