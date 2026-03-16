import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export type ScriptReviewNoteRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const NOTES_FILE = path.join(DATA_DIR, "script-review-notes.json");

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  try {
    await fs.access(NOTES_FILE);
  } catch {
    await fs.writeFile(NOTES_FILE, "[]", "utf8");
  }
}

async function readAllNotes(): Promise<ScriptReviewNoteRecord[]> {
  await ensureDataFile();
  const raw = await fs.readFile(NOTES_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScriptReviewNoteRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAllNotes(notes: ScriptReviewNoteRecord[]) {
  await ensureDataFile();
  await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), "utf8");
}

export async function getScriptReviewNotes(params: {
  userId: string;
  projectId: string | null;
}): Promise<ScriptReviewNoteRecord | null> {
  const all = await readAllNotes();
  return (
    all.find(
      (n) =>
        n.userId === params.userId &&
        (params.projectId === null ? n.projectId === null : n.projectId === params.projectId),
    ) ?? null
  );
}

export async function upsertScriptReviewNotes(params: {
  userId: string;
  projectId: string | null;
  body: string;
}): Promise<ScriptReviewNoteRecord> {
  const all = await readAllNotes();
  const existingIdx = all.findIndex(
    (n) =>
      n.userId === params.userId &&
      (params.projectId === null ? n.projectId === null : n.projectId === params.projectId),
  );
  const now = new Date().toISOString();

  if (existingIdx === -1) {
    const record: ScriptReviewNoteRecord = {
      id: crypto.randomUUID(),
      userId: params.userId,
      projectId: params.projectId,
      body: params.body,
      createdAt: now,
      updatedAt: now,
    };
    all.push(record);
    await writeAllNotes(all);
    return record;
  }

  const updated: ScriptReviewNoteRecord = {
    ...all[existingIdx],
    body: params.body,
    updatedAt: now,
  };
  all[existingIdx] = updated;
  await writeAllNotes(all);
  return updated;
}

