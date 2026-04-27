import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validateEmail, validatePassword } from "@/lib/auth-utils";
import { sendWelcomeEmail } from "@/lib/sendgrid";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    const name = body.name?.trim() || null;

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!validatePassword(password)) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "SUBSCRIBER",
      },
      select: { id: true, email: true, name: true },
    });

    try {
      await sendWelcomeEmail(user.email || email, user.name, { role: "SUBSCRIBER", registrationType: "viewer_signup" });
    } catch (emailError) {
      console.error("Welcome email send failed:", emailError);
    }

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique constraint/i.test(error.message)) {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    console.error("Signup failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
