import { getSessionStore, memoryCacheKey } from "@/lib/cache/session-store";

export type ScriptCollaborationPeer = {
  userId: string;
  displayName: string;
  image: string | null;
  color: string;
  mode: "writer" | "producer" | "read_only";
  cursorLine: number;
  cursorCol: number;
  selectionStart: number;
  selectionEnd: number;
  isTyping: boolean;
  isWriting: boolean;
  activeSceneHeading: string | null;
  lastSeen: number;
};

const ROOM_TTL_SECONDS = 25;
const STALE_MS = 20_000;

const PEER_COLORS = [
  "#f97316",
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#60a5fa",
  "#fb7185",
];

export function peerColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i) * 17) % PEER_COLORS.length;
  return PEER_COLORS[hash] ?? PEER_COLORS[0];
}

function roomKey(scriptId: string): string {
  return memoryCacheKey(["script-collab", scriptId]);
}

export async function upsertScriptPeer(
  scriptId: string,
  peer: Omit<ScriptCollaborationPeer, "lastSeen">,
): Promise<ScriptCollaborationPeer[]> {
  const store = await getSessionStore();
  const key = roomKey(scriptId);
  const now = Date.now();
  const raw = await store.get(key);
  const existing: ScriptCollaborationPeer[] = raw ? (JSON.parse(raw) as ScriptCollaborationPeer[]) : [];
  const fresh = existing.filter((p) => now - p.lastSeen < STALE_MS && p.userId !== peer.userId);
  const next: ScriptCollaborationPeer = { ...peer, lastSeen: now };
  fresh.push(next);
  await store.set(key, JSON.stringify(fresh), ROOM_TTL_SECONDS);
  return fresh;
}

export async function listScriptPeers(
  scriptId: string,
  excludeUserId?: string,
): Promise<ScriptCollaborationPeer[]> {
  const store = await getSessionStore();
  const raw = await store.get(roomKey(scriptId));
  if (!raw) return [];
  const now = Date.now();
  const peers = (JSON.parse(raw) as ScriptCollaborationPeer[]).filter(
    (p) => now - p.lastSeen < STALE_MS && p.userId !== excludeUserId,
  );
  return peers;
}

export async function removeScriptPeer(scriptId: string, userId: string): Promise<void> {
  const store = await getSessionStore();
  const key = roomKey(scriptId);
  const raw = await store.get(key);
  if (!raw) return;
  const now = Date.now();
  const peers = (JSON.parse(raw) as ScriptCollaborationPeer[]).filter(
    (p) => p.userId !== userId && now - p.lastSeen < STALE_MS,
  );
  if (peers.length === 0) {
    await store.del(key);
    return;
  }
  await store.set(key, JSON.stringify(peers), ROOM_TTL_SECONDS);
}
