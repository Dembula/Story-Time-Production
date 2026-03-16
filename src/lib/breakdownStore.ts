import fs from "fs/promises";
import path from "path";

export type BreakdownCharacter = {
  id: string;
  name: string;
  description: string | null;
  importance: string | null;
};

export type BreakdownProp = {
  id: string;
  name: string;
  description: string | null;
  special: boolean;
};

export type BreakdownLocation = {
  id: string;
  name: string;
  description: string | null;
};

export type BreakdownWardrobe = {
  id: string;
  description: string;
  character: string | null;
};

export type BreakdownExtra = {
  id: string;
  description: string;
  quantity: number;
};

export type BreakdownVehicle = {
  id: string;
  description: string;
  stuntRelated: boolean;
};

export type BreakdownStunt = {
  id: string;
  description: string;
  safetyNotes: string | null;
};

export type BreakdownSfx = {
  id: string;
  description: string;
  practical: boolean;
};

export type BreakdownRecord = {
  projectId: string;
  characters: BreakdownCharacter[];
  props: BreakdownProp[];
  locations: BreakdownLocation[];
  wardrobe: BreakdownWardrobe[];
  extras: BreakdownExtra[];
  vehicles: BreakdownVehicle[];
  stunts: BreakdownStunt[];
  sfx: BreakdownSfx[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "script-breakdown.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, "[]", "utf8");
  }
}

async function readAll(): Promise<BreakdownRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BreakdownRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: BreakdownRecord[]) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(records, null, 2), "utf8");
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getBreakdown(projectId: string): Promise<BreakdownRecord> {
  const all = await readAll();
  let record = all.find((r) => r.projectId === projectId);
  if (!record) {
    record = {
      projectId,
      characters: [],
      props: [],
      locations: [],
      wardrobe: [],
      extras: [],
      vehicles: [],
      stunts: [],
      sfx: [],
    };
    all.push(record);
    await writeAll(all);
  }
  return record;
}

export async function upsertBreakdown(
  projectId: string,
  payload: Partial<BreakdownRecord>,
): Promise<BreakdownRecord> {
  const all = await readAll();
  let record = all.find((r) => r.projectId === projectId);
  if (!record) {
    record = {
      projectId,
      characters: [],
      props: [],
      locations: [],
      wardrobe: [],
      extras: [],
      vehicles: [],
      stunts: [],
      sfx: [],
    };
    all.push(record);
  }

  function upsertList<T extends { id: string }>(
    existing: T[],
    incoming?: (Partial<T> & { id?: string })[],
    defaults?: Partial<T>,
  ): T[] {
    if (!incoming) return existing;
    const byId = new Map(existing.map((i) => [i.id, i]));
    const next: T[] = [];
    for (const item of incoming) {
      if (item.id && byId.has(item.id)) {
        next.push({ ...byId.get(item.id)!, ...(item as T) });
      } else {
        next.push({
          ...(defaults as T),
          ...(item as T),
          id: makeId(),
        });
      }
    }
    return next;
  }

  record.characters = upsertList(record.characters, payload.characters as any, {
    description: null,
    importance: null,
  });
  record.props = upsertList(record.props, payload.props as any, {
    description: null,
    special: false,
  });
  record.locations = upsertList(record.locations, payload.locations as any, {
    description: null,
  });
  record.wardrobe = upsertList(record.wardrobe, payload.wardrobe as any, {
    character: null,
  });
  record.extras = upsertList(record.extras, payload.extras as any, {
    quantity: 1,
  });
  record.vehicles = upsertList(record.vehicles, payload.vehicles as any, {
    stuntRelated: false,
  });
  record.stunts = upsertList(record.stunts, payload.stunts as any, {
    safetyNotes: null,
  });
  record.sfx = upsertList(record.sfx, payload.sfx as any, {
    practical: false,
  });

  await writeAll(all);
  return record;
}

