import { NextRequest, NextResponse } from "next/server";
import { enforceSignupRateLimit, rateLimitedResponse } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/sendgrid";
import { ensureUserRole } from "@/lib/user-roles";
import {
  getClientIpFromRequest,
  getDeviceTypeForRequest,
  getUserAgentFromRequest,
} from "@/lib/request-client-meta";

/**
 * POST /api/auth/signup — Create a new viewer (subscriber) account.
 * Used by web signup and Universe / Creators native apps.
 * Creates user with role SUBSCRIBER and hashed password.
 */
export async function POST(request: NextRequest) {
  const rate = await enforceSignupRateLimit(request);
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfterSeconds, "Too many sign-up attempts. Try again later.");
  }

  try {
    let body: { email?: string; password?: string; name?: string; platform?: string; source?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body. Send JSON with email, password, and optional name." },
        { status: 400 }
      );
    }

    const { email, password, name } = body;
    const normalizedEmail = email?.trim()?.toLowerCase();
    if (!normalizedEmail || !password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Email and password (min 6 characters) are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true, role: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in or reset your password." },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 10);
    const deviceType = getDeviceTypeForRequest(request);
    const ipAddress = getClientIpFromRequest(request);
    const userAgent = getUserAgentFromRequest(request);
    const platformHint =
      (typeof body.platform === "string" && body.platform.trim()) ||
      (typeof body.source === "string" && body.source.trim()) ||
      null;

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        role: "SUBSCRIBER",
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });
    await ensureUserRole(user.id, "SUBSCRIBER");

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        userEmail: user.email ?? undefined,
        userName: user.name ?? undefined,
        role: "SUBSCRIBER",
        eventType: "REGISTER",
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? (platformHint ? `signup/${platformHint}` : undefined),
        deviceType,
      },
    }).catch((err) => {
      console.warn("[signup] activity log failed:", err);
    });

    try {
      if (user.email) {
        await sendWelcomeEmail(user.email, user.name, { role: "SUBSCRIBER", registrationType: "viewer_signup" });
      }
    } catch (emailError) {
      console.error("Welcome email send failed:", emailError);
    }

    return NextResponse.json({ ok: true, deviceType }, { status: 201 });
  } catch (e) {
    const err = e as Error;
    console.error("Viewer signup error:", err?.message ?? e);
    const isDev = process.env.NODE_ENV !== "production";
    const message = isDev && err?.message ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
