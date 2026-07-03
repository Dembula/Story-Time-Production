import { NextRequest } from "next/server";

/**
 * Cron endpoints must fail closed when CRON_SECRET is unset in production.
 * In development, missing secret allows local testing without bearer token.
 */
export function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}
