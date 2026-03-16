import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type ScriptType = "FEATURE" | "SHORT" | "EPISODE" | "OTHER";

export type ScriptRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  type: ScriptType;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const SCRIPTS_FILE = path.join(DATA_DIR, "scripts.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  try {
    await fs.access(SCRIPTS_FILE);
  } catch {
    await fs.writeFile(SCRIPTS_FILE, "[]", "utf8");
  }
}

async function readAllScripts(): Promise<ScriptRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(SCRIPTS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScriptRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAllScripts(scripts: ScriptRecord[]) {
  await ensureDataFile();
  await fs.writeFile(SCRIPTS_FILE, JSON.stringify(scripts, null, 2), "utf8");
}

export async function listScriptsForUser(options: {
  userId: string;
  projectId?: string | null;
}) {
  const { userId, projectId } = options;
  const all = await readAllScripts();
  return all.filter((script) => {
    if (script.userId !== userId) return false;
    if (projectId === undefined) return true;
    return projectId === null ? script.projectId === null : script.projectId === projectId;
  });
}

export async function createScriptForUser(params: {
  userId: string;
  projectId: string | null;
  title?: string;
  type?: ScriptType;
  content?: string;
}): Promise<ScriptRecord> {
  const all = await readAllScripts();
  const now = new Date().toISOString();
  const record: ScriptRecord = {
    id: crypto.randomUUID(),
    userId: params.userId,
    projectId: params.projectId,
    title: params.title?.trim() || "New script",
    type: params.type ?? "FEATURE",
    content: params.content ?? "",
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(record);
  await writeAllScripts(all);
  return record;
}

export async function updateScriptForUser(params: {
  userId: string;
  id: string;
  projectId?: string | null;
  title?: string;
  type?: ScriptType;
  content?: string;
}): Promise<ScriptRecord | null> {
  const all = await readAllScripts();
  const idx = all.findIndex(
    (s) =>
      s.id === params.id &&
      s.userId === params.userId &&
      (params.projectId === undefined
        ? true
        : params.projectId === null
        ? s.projectId === null
        : s.projectId === params.projectId),
  );
  if (idx === -1) return null;
  const current = all[idx];
  const updated: ScriptRecord = {
    ...current,
    ...(params.title !== undefined ? { title: params.title } : {}),
    ...(params.type !== undefined ? { type: params.type } : {}),
    ...(params.content !== undefined ? { content: params.content } : {}),
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  await writeAllScripts(all);
  return updated;
}

