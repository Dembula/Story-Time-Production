import fs from "fs/promises";
import path from "path";

export type BudgetLine = {
  id: string;
  department: string;
  name: string;
  quantity: number;
  unitCost: number;
  total: number;
  notes: string | null;
};

export type BudgetRecord = {
  projectId: string;
  template: "SHORT_FILM" | "INDIE_FILM" | "FEATURE_FILM" | "TV_EPISODE";
  lines: BudgetLine[];
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "project-budgets.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, "[]", "utf8");
  }
}

async function readAll(): Promise<BudgetRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BudgetRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: BudgetRecord[]) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(records, null, 2), "utf8");
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getBudget(projectId: string): Promise<BudgetRecord | null> {
  const all = await readAll();
  return all.find((b) => b.projectId === projectId) ?? null;
}

const TEMPLATE_LINES: Record<BudgetRecord["template"], Omit<BudgetLine, "id">[]> = {
  SHORT_FILM: [
    { department: "PRODUCING", name: "Producer fee", quantity: 1, unitCost: 0, total: 0, notes: null },
    { department: "CAMERA", name: "Camera package", quantity: 3, unitCost: 0, total: 0, notes: null },
    { department: "SOUND", name: "Sound recordist", quantity: 3, unitCost: 0, total: 0, notes: null },
  ],
  INDIE_FILM: [
    { department: "PRODUCING", name: "Producer fee", quantity: 1, unitCost: 0, total: 0, notes: null },
    { department: "CAMERA", name: "Camera package", quantity: 10, unitCost: 0, total: 0, notes: null },
    { department: "GRIP", name: "Grip & lighting", quantity: 10, unitCost: 0, total: 0, notes: null },
    { department: "SOUND", name: "Sound recordist", quantity: 10, unitCost: 0, total: 0, notes: null },
  ],
  FEATURE_FILM: [
    { department: "PRODUCING", name: "Producer fee", quantity: 1, unitCost: 0, total: 0, notes: null },
    { department: "CAMERA", name: "Camera package", quantity: 30, unitCost: 0, total: 0, notes: null },
    { department: "GRIP", name: "Grip & lighting", quantity: 30, unitCost: 0, total: 0, notes: null },
    { department: "SOUND", name: "Sound recordist", quantity: 30, unitCost: 0, total: 0, notes: null },
    { department: "POST", name: "Editing & post", quantity: 1, unitCost: 0, total: 0, notes: null },
  ],
  TV_EPISODE: [
    { department: "PRODUCING", name: "Producer fee", quantity: 1, unitCost: 0, total: 0, notes: null },
    { department: "CAMERA", name: "Camera package", quantity: 7, unitCost: 0, total: 0, notes: null },
    { department: "GRIP", name: "Grip & lighting", quantity: 7, unitCost: 0, total: 0, notes: null },
    { department: "SOUND", name: "Sound recordist", quantity: 7, unitCost: 0, total: 0, notes: null },
  ],
};

export async function initBudget(projectId: string, template: BudgetRecord["template"]) {
  const all = await readAll();
  const existing = all.find((b) => b.projectId === projectId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const baseLines = TEMPLATE_LINES[template] ?? [];
  const record: BudgetRecord = {
    projectId,
    template,
    lines: baseLines.map((l) => ({ ...l, id: makeId() })),
    updatedAt: now,
  };
  all.push(record);
  await writeAll(all);
  return record;
}

export async function saveBudgetLines(projectId: string, lines: Partial<BudgetLine>[]) {
  const all = await readAll();
  const idx = all.findIndex((b) => b.projectId === projectId);
  if (idx === -1) return null;
  const nextLines: BudgetLine[] = lines.map((l) => {
    const qty = l.quantity ?? 1;
    const unitCost = l.unitCost ?? 0;
    return {
      id: l.id || makeId(),
      department: l.department || "UNASSIGNED",
      name: l.name || "",
      quantity: qty,
      unitCost,
      total: qty * unitCost,
      notes: l.notes ?? null,
    };
  });
  const updated: BudgetRecord = {
    ...all[idx],
    lines: nextLines,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  await writeAll(all);
  return updated;
}

