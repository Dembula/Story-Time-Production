import fs from "fs/promises";
import path from "path";

export type ScheduleScene = {
  id: string;
  number: string;
  heading: string | null;
};

export type ShootDaySceneLink = {
  sceneId: string;
  order: number;
};

export type ShootDayRecord = {
  id: string;
  date: string;
  unit: string | null;
  callTime: string | null;
  wrapTime: string | null;
  status: string;
  locationSummary: string | null;
  /** Free-text: what scenes are being shot today (editable by creator) */
  scenesBeingShot: string | null;
  scenes: ShootDaySceneLink[];
};

export type ScheduleRecord = {
  projectId: string;
  shootDays: ShootDayRecord[];
  scenes: ScheduleScene[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "project-schedules.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, "[]", "utf8");
  }
}

async function readAll(): Promise<ScheduleRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScheduleRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: ScheduleRecord[]) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(records, null, 2), "utf8");
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getSchedule(projectId: string): Promise<ScheduleRecord> {
  const all = await readAll();
  let record = all.find((r) => r.projectId === projectId);
  if (!record) {
    record = {
      projectId,
      shootDays: [],
      scenes: [],
    };
    all.push(record);
    await writeAll(all);
  }
  return record;
}

export async function createShootDay(projectId: string, dateIso: string): Promise<ShootDayRecord> {
  const all = await readAll();
  let record = all.find((r) => r.projectId === projectId);
  if (!record) {
    record = {
      projectId,
      shootDays: [],
      scenes: [],
    };
    all.push(record);
  }
  const day: ShootDayRecord = {
    id: makeId(),
    date: dateIso,
    unit: null,
    callTime: null,
    wrapTime: null,
    status: "PLANNED",
    locationSummary: null,
    scenesBeingShot: null,
    scenes: [],
  };
  record.shootDays.push(day);
  await writeAll(all);
  return day;
}

export async function saveSchedule(projectId: string, days: ShootDayRecord[]) {
  const all = await readAll();
  const idx = all.findIndex((r) => r.projectId === projectId);
  if (idx === -1) return null;
  const updated: ScheduleRecord = {
    ...all[idx],
    shootDays: days,
  };
  all[idx] = updated;
  await writeAll(all);
  return updated;
}

export async function updateScenesLibraryFromScript(projectId: string, scenes: ScheduleScene[]) {
  const all = await readAll();
  let record = all.find((r) => r.projectId === projectId);
  if (!record) {
    record = {
      projectId,
      shootDays: [],
      scenes: [],
    };
    all.push(record);
  }
  if (record.scenes.length === 0 && scenes.length > 0) {
    record.scenes = scenes;
    await writeAll(all);
  }
  return record;
}

