type Bucket = {
  count: number;
  resetAt: number;
};

const globalBuckets = globalThis as unknown as {
  __storytimeRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalBuckets.__storytimeRateLimitBuckets ?? new Map<string, Bucket>();
globalBuckets.__storytimeRateLimitBuckets = buckets;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

function getClientIp(ip: string | null): string {
  if (!ip) return "unknown";
  return ip.split(",")[0]?.trim() || "unknown";
}

function memoryCheckRateLimit(input: {
  key: string;
  ip: string | null;
  maxAttempts: number;
  windowMs: number;
  increment?: boolean;
}): RateLimitResult {
  const increment = input.increment !== false;
  const ip = getClientIp(input.ip);
  const now = Date.now();
  const bucketKey = `${input.key}:${ip}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    if (increment) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + input.windowMs,
      });
    }
    return { allowed: true, retryAfterSeconds: Math.ceil(input.windowMs / 1000) };
  }

  if (existing.count >= input.maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  if (increment) {
    existing.count += 1;
    buckets.set(bucketKey, existing);
  }
  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function memoryRecordRateLimitFailure(input: {
  key: string;
  ip: string | null;
  windowMs: number;
}): void {
  const ip = getClientIp(input.ip);
  const now = Date.now();
  const bucketKey = `${input.key}:${ip}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: now + input.windowMs,
    });
    return;
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);
}

async function redisCheckRateLimit(input: {
  key: string;
  ip: string | null;
  maxAttempts: number;
  windowMs: number;
  increment?: boolean;
}): Promise<RateLimitResult | null> {
  if (!process.env.REDIS_URL?.trim()) return null;

  try {
    const { getSessionStore } = await import("@/lib/cache/session-store");
    const store = await getSessionStore();
    const increment = input.increment !== false;
    const ip = getClientIp(input.ip);
    const bucketKey = `rl:${input.key}:${ip}`;
    const windowSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));

    const raw = await store.get(bucketKey);
    const parsed = raw ? (JSON.parse(raw) as Bucket) : null;
    const now = Date.now();

    if (!parsed || parsed.resetAt <= now) {
      if (increment) {
        const next: Bucket = { count: 1, resetAt: now + input.windowMs };
        await store.set(bucketKey, JSON.stringify(next), windowSeconds);
      }
      return { allowed: true, retryAfterSeconds: windowSeconds };
    }

    if (parsed.count >= input.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((parsed.resetAt - now) / 1000)),
      };
    }

    if (increment) {
      parsed.count += 1;
      await store.set(
        bucketKey,
        JSON.stringify(parsed),
        Math.max(1, Math.ceil((parsed.resetAt - now) / 1000)),
      );
    }

    return {
      allowed: true,
      retryAfterSeconds: Math.max(1, Math.ceil((parsed.resetAt - now) / 1000)),
    };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Redis rate limit fallback to memory:", e);
    }
    return null;
  }
}

async function redisRecordRateLimitFailure(input: {
  key: string;
  ip: string | null;
  windowMs: number;
}): Promise<boolean> {
  if (!process.env.REDIS_URL?.trim()) return false;

  try {
    const { getSessionStore } = await import("@/lib/cache/session-store");
    const store = await getSessionStore();
    const ip = getClientIp(input.ip);
    const bucketKey = `rl:${input.key}:${ip}`;
    const windowSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));
    const now = Date.now();

    const raw = await store.get(bucketKey);
    const parsed = raw ? (JSON.parse(raw) as Bucket) : null;

    if (!parsed || parsed.resetAt <= now) {
      await store.set(
        bucketKey,
        JSON.stringify({ count: 1, resetAt: now + input.windowMs }),
        windowSeconds,
      );
      return true;
    }

    parsed.count += 1;
    await store.set(
      bucketKey,
      JSON.stringify(parsed),
      Math.max(1, Math.ceil((parsed.resetAt - now) / 1000)),
    );
    return true;
  } catch {
    return false;
  }
}

/** Distributed rate limit (Redis when REDIS_URL is set, in-memory fallback). */
export async function checkRateLimit(input: {
  key: string;
  ip: string | null;
  maxAttempts: number;
  windowMs: number;
  increment?: boolean;
}): Promise<RateLimitResult> {
  const redisResult = await redisCheckRateLimit(input);
  if (redisResult) return redisResult;
  return memoryCheckRateLimit(input);
}

/** Increment counter after a failed attempt. */
export async function recordRateLimitFailure(input: {
  key: string;
  ip: string | null;
  windowMs: number;
}): Promise<void> {
  const usedRedis = await redisRecordRateLimitFailure(input);
  if (!usedRedis) memoryRecordRateLimitFailure(input);
}
