import { getSessionStore, memoryCacheKey } from "@/lib/cache/session-store";

export type ReviewPeer = {
  userId: string;
  displayName: string;
  image: string | null;
  color: string;
  pageIndex: number;
  lineIndex: number | null;
  cursorX: number | null;
  cursorY: number | null;
  cursorChar: number | null;
  isDrawing: boolean;
  isTyping: boolean;
  tool: string | null;
  lastSeen: number;
};

const TTL = 25;
const STALE_MS = 20_000;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#06b6d4"];

export function reviewPeerColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h + userId.charCodeAt(i) * 13) % COLORS.length;
  return COLORS[h] ?? COLORS[0];
}

function key(sessionId: string): string {
  return memoryCacheKey(["script-review-collab", sessionId]);
}

export async function upsertReviewPeer(
  sessionId: string,
  peer: Omit<ReviewPeer, "lastSeen">,
): Promise<ReviewPeer[]> {
  const store = await getSessionStore();
  const now = Date.now();
  const raw = await store.get(key(sessionId));
  const list: ReviewPeer[] = raw ? (JSON.parse(raw) as ReviewPeer[]) : [];
  const next = list.filter((p) => now - p.lastSeen < STALE_MS && p.userId !== peer.userId);
  next.push({ ...peer, lastSeen: now });
  await store.set(key(sessionId), JSON.stringify(next), TTL);
  return next;
}

export async function listReviewPeers(sessionId: string, excludeUserId?: string): Promise<ReviewPeer[]> {
  const store = await getSessionStore();
  const raw = await store.get(key(sessionId));
  if (!raw) return [];
  const now = Date.now();
  return (JSON.parse(raw) as ReviewPeer[]).filter(
    (p) => now - p.lastSeen < STALE_MS && p.userId !== excludeUserId,
  );
}
