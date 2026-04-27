import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { validatePassword } from "@/lib/auth-utils";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit({
    key: "reset-password-confirm",
    ip: request.headers.get("x-forwarded-for"),
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = (await request.json()) as { token?: string; newPassword?: string; password?: string };
    const rawToken = body.token?.trim() || "";
    const newPassword = body.newPassword || body.password || "";

    if (!rawToken) {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }
    if (!validatePassword(newPassword)) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const passwordHash = await hash(newPassword, 10);
    const ok = await consumePasswordResetToken({ token: rawToken, newPasswordHash: passwordHash });
    if (!ok) {
      return NextResponse.json({ error: "Token is invalid or expired." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
