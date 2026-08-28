import { NextRequest, NextResponse } from "next/server";
import {
  TV_CORS_HEADERS,
  authenticateViewerCredentials,
  sessionFromTvRequest,
} from "@/lib/tv-auth";
import { checkRateLimit, recordRateLimitFailure } from "@/lib/rate-limit";
import { getClientIpFromRequest, isSignInRateLimitEnabled } from "@/lib/auth-rate-limit";
import {
  getDeviceTypeForRequest,
  getUserAgentFromRequest,
} from "@/lib/request-client-meta";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: TV_CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: TV_CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const session = await sessionFromTvRequest(request);
  if (!session) return json({ user: null });
  return json(session);
}

export async function DELETE() {
  // Bearer tokens are stateless JWTs; the client drops its stored token.
  return json({ ok: true });
}

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (isSignInRateLimitEnabled()) {
    const ip = getClientIpFromRequest(request);
    const ipRate = await checkRateLimit({
      key: "auth-signin",
      ip,
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
      increment: false,
    });
    if (!ipRate.allowed) {
      return json({ error: "Too many sign-in attempts. Try again later." }, 429);
    }
    const emailRate = await checkRateLimit({
      key: "auth-signin-email",
      ip: email.trim().toLowerCase() || "unknown",
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      increment: false,
    });
    if (!emailRate.allowed) {
      return json({ error: "Too many sign-in attempts. Try again later." }, 429);
    }
  }

  const result = await authenticateViewerCredentials(email, password);
  if (!result.ok) {
    if (isSignInRateLimitEnabled() && result.status === 401) {
      const ip = getClientIpFromRequest(request);
      await recordRateLimitFailure({ key: "auth-signin", ip, windowMs: 15 * 60 * 1000 });
      if (email.trim()) {
        await recordRateLimitFailure({
          key: "auth-signin-email",
          ip: email.trim().toLowerCase(),
          windowMs: 15 * 60 * 1000,
        });
      }
    }
    return json({ error: result.error }, result.status);
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: result.session.user.id,
        userEmail: result.session.user.email ?? undefined,
        userName: result.session.user.name ?? undefined,
        role: result.session.user.role,
        eventType: "SIGN_IN",
        ipAddress: getClientIpFromRequest(request) ?? undefined,
        userAgent: getUserAgentFromRequest(request) ?? undefined,
        deviceType: getDeviceTypeForRequest(request) || "tv",
      },
    });
  } catch (err) {
    console.warn("[tv/session] activity log failed:", err);
  }

  return json({
    token: result.token,
    session: result.session,
    user: result.session.user,
    expiresIn: 30 * 24 * 60 * 60,
  });
}
