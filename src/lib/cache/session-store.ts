/**
 * Session store abstraction — Redis when REDIS_URL is set, in-memory fallback otherwise.
 */

type SessionStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

class MemorySessionStore implements SessionStore {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const row = this.map.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return row.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

class RedisSessionStore implements SessionStore {
  constructor(
    private readonly client: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, expiryMode: "EX", ttlSeconds: number): Promise<unknown>;
      del(key: string): Promise<unknown>;
    },
  ) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

let cachedStore: SessionStore | null = null;

export async function getSessionStore(): Promise<SessionStore> {
  if (cachedStore) return cachedStore;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 3000,
      });
      await client.connect();
      cachedStore = new RedisSessionStore(client);
      return cachedStore;
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Redis unavailable — using in-memory session store:", e);
      }
    }
  }

  cachedStore = new MemorySessionStore();
  return cachedStore;
}

export function memoryCacheKey(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(":");
}
