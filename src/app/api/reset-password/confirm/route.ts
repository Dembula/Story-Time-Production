import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { normalizePasswordResetToken } from "@/lib/password-reset-token";
import { validatePassword } from "@/lib/auth-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromRequest } from "@/lib/auth-rate-limit";

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit({
    key: "reset-password-confirm",
    ip: getClientIpFromRequest(request),
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  try {
    const body = (await request.json()) as { token?: string; newPassword?: string; password?: string };
    const rawToken = normalizePasswordResetToken(body.token);
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
      return NextResponse.json(
        { error: "This reset link is invalid or expired. Request a new password reset email." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
