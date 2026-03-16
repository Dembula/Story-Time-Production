import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type IdeaRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  logline: string | null;
  notes: string | null;
  genres: string | null;
  convertedToProject: boolean;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const IDEAS_FILE = path.join(DATA_DIR, "project-ideas.json");

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
  try {
    await fs.access(IDEAS_FILE);
  } catch {
    await fs.writeFile(IDEAS_FILE, "[]", "utf8");
  }
}

async function readAllIdeas(): Promise<IdeaRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(IDEAS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IdeaRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAllIdeas(ideas: IdeaRecord[]) {
  await ensureDataFile();
  await fs.writeFile(IDEAS_FILE, JSON.stringify(ideas, null, 2), "utf8");
}

export async function listIdeasForUser(userId: string, projectId: string | null) {
  const all = await readAllIdeas();
  return all.filter(
    (idea) =>
      idea.userId === userId &&
      (projectId === null ? idea.projectId === null : idea.projectId === projectId),
  );
}

export async function createIdeaForUser(params: {
  userId: string;
  projectId: string | null;
  title: string;
  logline?: string | null;
  notes?: string | null;
  genres?: string | null;
}): Promise<IdeaRecord> {
  const all = await readAllIdeas();
  const now = new Date().toISOString();
  const idea: IdeaRecord = {
    id: crypto.randomUUID(),
    userId: params.userId,
    projectId: params.projectId,
    title: params.title,
    logline: params.logline ?? null,
    notes: params.notes ?? null,
    genres: params.genres ?? null,
    convertedToProject: false,
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(idea);
  await writeAllIdeas(all);
  return idea;
}

export async function updateIdeaForUser(params: {
  userId: string;
  id: string;
  projectId: string | null;
  title?: string;
  logline?: string | null;
  notes?: string | null;
  genres?: string | null;
  convertedToProject?: boolean;
}): Promise<IdeaRecord | null> {
  const all = await readAllIdeas();
  const idx = all.findIndex(
    (idea) =>
      idea.id === params.id &&
      idea.userId === params.userId &&
      ((params.projectId === null && idea.projectId === null) ||
        (params.projectId !== null && idea.projectId === params.projectId)),
  );
  if (idx === -1) return null;
  const current = all[idx];
  const updated: IdeaRecord = {
    ...current,
    ...(params.title !== undefined ? { title: params.title } : {}),
    ...(params.logline !== undefined ? { logline: params.logline } : {}),
    ...(params.notes !== undefined ? { notes: params.notes } : {}),
    ...(params.genres !== undefined ? { genres: params.genres } : {}),
    ...(params.convertedToProject !== undefined
      ? { convertedToProject: params.convertedToProject }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  await writeAllIdeas(all);
  return updated;
}

export async function countIdeasByProjectForUser(userId: string): Promise<Map<string, number>> {
  const all = await readAllIdeas();
  const map = new Map<string, number>();
  for (const idea of all) {
    if (idea.userId !== userId || !idea.projectId) continue;
    const current = map.get(idea.projectId) ?? 0;
    map.set(idea.projectId, current + 1);
  }
  return map;
}

