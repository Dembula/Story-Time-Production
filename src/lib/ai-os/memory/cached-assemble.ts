import type { AssembleStoryTimeMemoryParams, AssembledStoryTimeMemory } from "./types";
import { assembleStoryTimeMemory } from "./assemble";
import { getSessionStore, memoryCacheKey } from "@/lib/cache/session-store";

const MEMORY_CACHE_TTL_SEC = 120;

function cacheKey(params: AssembleStoryTimeMemoryParams): string {
  return memoryCacheKey([
    "st:memory",
    params.userId,
    params.projectId ?? "none",
    params.conversationId ?? "none",
  ]);
}

/** Assemble memory with Redis/in-memory hot cache (conversation + user layers). */
export async function assembleStoryTimeMemoryCached(
  params: AssembleStoryTimeMemoryParams,
): Promise<AssembledStoryTimeMemory & { cacheHit: boolean }> {
  if (process.env.AI_MEMORY_CACHE_ENABLED === "false") {
    const fresh = await assembleStoryTimeMemory(params);
    return { ...fresh, cacheHit: false };
  }

  const store = await getSessionStore();
  const key = cacheKey(params);

  try {
    const raw = await store.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as AssembledStoryTimeMemory;
      return { ...parsed, cacheHit: true };
    }
  } catch {
    /* cache miss on parse error */
  }

  const fresh = await assembleStoryTimeMemory(params);
  void store.set(key, JSON.stringify(fresh), MEMORY_CACHE_TTL_SEC).catch(() => {});

  return { ...fresh, cacheHit: false };
}

export async function invalidateMemoryCache(params: {
  userId: string;
  projectId?: string | null;
  conversationId?: string | null;
}): Promise<void> {
  const store = await getSessionStore();
  await store.del(cacheKey(params));
}
