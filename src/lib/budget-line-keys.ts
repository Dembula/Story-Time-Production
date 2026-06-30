/** Stable keys for budget rows — prevents duplicate rendering and double-counting. */

const KEY_MARKER_START = "[ST_BUDGET_KEY]";
const KEY_MARKER_END = "[/ST_BUDGET_KEY]";

const ENGINE_ALLOCATION_NAMES = new Set(
  [
    "cast allocation",
    "crew allocation",
    "equipment rental",
    "location and permits",
    "art department",
    "wardrobe and makeup",
    "sound capture",
    "transport and logistics",
    "catering",
    "post production allocation",
  ].map((s) => s.toLowerCase()),
);

export function budgetRowKey(input: {
  key?: string;
  sceneId?: string | null;
  department: string;
  name: string;
  id?: string;
}): string {
  if (input.key?.trim()) return input.key.trim().toLowerCase();
  if (input.sceneId) {
    return `${input.sceneId}:${input.department}:${input.name}`.toLowerCase();
  }
  if (input.id) return `manual|${input.id}`.toLowerCase();
  return `global|${input.department}|${input.name}`.toLowerCase();
}

export function embedBudgetLineKey(notes: string | null | undefined, key: string): string {
  const plain = stripBudgetLineKey(notes);
  const marker = `${KEY_MARKER_START}${key}${KEY_MARKER_END}`;
  return plain ? `${marker}\n${plain}` : marker;
}

export function stripBudgetLineKey(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(new RegExp(`${KEY_MARKER_START}[\\s\\S]*?${KEY_MARKER_END}\\n?`, "g"), "")
    .trim();
}

export function extractBudgetLineKey(
  notes: string | null | undefined,
  fallback: { sceneId?: string | null; department: string; name: string; id?: string },
): string {
  if (notes) {
    const match = notes.match(
      new RegExp(`${KEY_MARKER_START.replace(/[[\]]/g, "\\$&")}([\\s\\S]*?)${KEY_MARKER_END.replace(/[[\]]/g, "\\$&")}`),
    );
    if (match?.[1]?.trim()) return match[1].trim().toLowerCase();
  }
  return budgetRowKey(fallback);
}

export function isEngineSceneAllocationLine(name: string): boolean {
  return ENGINE_ALLOCATION_NAMES.has(name.trim().toLowerCase());
}

export type BudgetManualLine = {
  department: string;
  name: string;
  quantity?: number | null;
  unitCost?: number | null;
  total?: number | null;
  notes?: string | null;
};

/** Lines that should augment engine totals (not scene allocations already computed live). */
export function filterSupplementalManualLines(lines: BudgetManualLine[]): BudgetManualLine[] {
  return lines.filter((line) => {
    const key = extractBudgetLineKey(line.notes, {
      department: line.department,
      name: line.name,
    });
    if (key.includes(":") && isEngineSceneAllocationLine(line.name)) return false;
    if (isEngineSceneAllocationLine(line.name) && !line.notes?.includes(KEY_MARKER_START)) {
      return false;
    }
    return true;
  });
}

export function dedupeBudgetRowsByKey<T extends { key: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const k = row.key.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}
