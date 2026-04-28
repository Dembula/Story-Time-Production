import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/sendgrid";
import { ensureUserRole } from "@/lib/user-roles";

/**
 * POST /api/auth/signup — Create a new viewer (subscriber) account.
 * Used by /auth/signup. Creates user with role SUBSCRIBER and hashed password.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; password?: string; name?: string };
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
      if (existing.passwordHash) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      const passwordHash = await hash(password, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      await ensureUserRole(existing.id, "SUBSCRIBER");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const passwordHash = await hash(password, 10);

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

    try {
      if (user.email) {
        await sendWelcomeEmail(user.email, user.name, { role: "SUBSCRIBER", registrationType: "viewer_signup" });
      }
    } catch (emailError) {
      console.error("Welcome email send failed:", emailError);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    const err = e as Error;
    console.error("Viewer signup error:", err?.message ?? e);
    const isDev = process.env.NODE_ENV !== "production";
    const message = isDev && err?.message ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
