import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Per-user rate limit for API routes. Returns a 429 response when exceeded,
 * or null when the request is allowed.
 */
export async function enforceUserRateLimit(args: {
  key: string;
  userId: string;
  maxAttempts: number;
  windowMs: number;
}): Promise<NextResponse | null> {
  const rate = await checkRateLimit({
    key: args.key,
    ip: args.userId,
    maxAttempts: args.maxAttempts,
    windowMs: args.windowMs,
  });
  if (rate.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    },
  );
}
