import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; password?: string; newPassword?: string };
    const token = body.token?.trim();
    const password = body.password ?? body.newPassword ?? "";

    if (!token) {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const passwordHash = await hash(password, 10);
    const ok = await consumePasswordResetToken({ token, newPasswordHash: passwordHash });
    if (!ok) {
      return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
