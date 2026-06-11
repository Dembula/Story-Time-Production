type Bucket = {
  count: number;
  resetAt: number;
};

const globalBuckets = globalThis as unknown as {
  __storytimeRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalBuckets.__storytimeRateLimitBuckets ?? new Map<string, Bucket>();
globalBuckets.__storytimeRateLimitBuckets = buckets;

function getClientIp(ip: string | null): string {
  if (!ip) return "unknown";
  return ip.split(",")[0]?.trim() || "unknown";
}

export function checkRateLimit(input: {
  key: string;
  ip: string | null;
  maxAttempts: number;
  windowMs: number;
  /** When false, only read the bucket (for pre-checks). When true, increment on allowed requests. */
  increment?: boolean;
}): { allowed: boolean; retryAfterSeconds: number } {
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

/** Increment the rate-limit counter after a failed attempt. */
export function recordRateLimitFailure(input: {
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
