import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/utils";

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
    const body = (await request.json()) as { token?: string; newPassword?: string };
    const rawToken = body.token?.trim() || "";
    const newPassword = body.newPassword || "";

    if (!rawToken) {
      return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
    }
    if (!validatePassword(newPassword)) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const tokenDigest = hashToken(rawToken);
    const tokenRecord = await db.passwordResetToken.findFirst({
      where: {
        token: tokenDigest,
        used: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: "Token is invalid or expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.$transaction([
      db.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
