import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

import { checkRateLimit, recordRateLimitFailure } from "@/lib/rate-limit";

const SIGNIN_MAX_ATTEMPTS = 10;
const SIGNIN_WINDOW_MS = 15 * 60 * 1000;
const SIGNIN_EMAIL_MAX_ATTEMPTS = 5;
const SIGNUP_MAX_ATTEMPTS = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export function isSignInRateLimitEnabled(): boolean {
  return process.env.NODE_ENV !== "development";
}

export function getClientIpFromRequest(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
}

export function rateLimitedResponse(retryAfterSeconds: number, message = "Too many attempts. Try again later.") {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function enforceSignupRateLimit(request: NextRequest) {
  return checkRateLimit({
    key: "auth-signup",
    ip: getClientIpFromRequest(request),
    maxAttempts: SIGNUP_MAX_ATTEMPTS,
    windowMs: SIGNUP_WINDOW_MS,
  });
}

async function peekCredentialSignInIpRate(request: NextRequest) {
  return checkRateLimit({
    key: "auth-signin",
    ip: getClientIpFromRequest(request),
    maxAttempts: SIGNIN_MAX_ATTEMPTS,
    windowMs: SIGNIN_WINDOW_MS,
    increment: false,
  });
}

async function peekCredentialSignInEmailRate(request: NextRequest) {
  const ipRate = await peekCredentialSignInIpRate(request);
  if (!ipRate.allowed) return ipRate;

  try {
    const form = await request.clone().formData();
    const email = form.get("email")?.toString().trim().toLowerCase();
    if (!email) return { allowed: true, retryAfterSeconds: 0 };

    return checkRateLimit({
      key: "auth-signin-email",
      ip: email,
      maxAttempts: SIGNIN_EMAIL_MAX_ATTEMPTS,
      windowMs: SIGNIN_WINDOW_MS,
      increment: false,
    });
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export async function enforceCredentialSignInRateLimitWithEmail(request: NextRequest) {
  if (!isSignInRateLimitEnabled()) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return peekCredentialSignInEmailRate(request);
}

export async function recordFailedCredentialSignIn(request: NextRequest): Promise<void> {
  if (!isSignInRateLimitEnabled()) return;

  const ip = getClientIpFromRequest(request);
  await recordRateLimitFailure({
    key: "auth-signin",
    ip,
    windowMs: SIGNIN_WINDOW_MS,
  });

  try {
    const form = await request.clone().formData();
    const email = form.get("email")?.toString().trim().toLowerCase();
    if (!email) return;
    await recordRateLimitFailure({
      key: "auth-signin-email",
      ip: email,
      windowMs: SIGNIN_WINDOW_MS,
    });
  } catch {
    // ignore malformed bodies
  }
}

export async function isFailedCredentialSignInResponse(response: Response): Promise<boolean> {
  if (response.status === 401 || response.status === 403) return true;
  if (response.status !== 200) return true;

  try {
    const body = (await response.clone().json()) as { error?: string; ok?: boolean };
    return body.error === "CredentialsSignin" || body.ok === false;
  } catch {
    return false;
  }
}

export function isCredentialSignInRequest(pathname: string): boolean {
  return /\/api\/auth\/callback\/credentials-/.test(pathname);
}
