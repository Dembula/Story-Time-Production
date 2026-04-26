import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/sendgrid";
import { checkRateLimit } from "@/lib/rate-limit";
import { addMinutes, generateSecureToken, getBaseUrl, hashToken } from "@/lib/utils";
import { validateEmail } from "@/lib/auth-utils";

const TOKEN_EXPIRY_MINUTES = 20;

export async function POST(request: NextRequest) {
  const rate = checkRateLimit({
    key: "reset-password-request",
    ip: request.headers.get("x-forwarded-for"),
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user?.email) {
      const rawToken = generateSecureToken();
      const tokenDigest = hashToken(rawToken);
      const expiresAt = addMinutes(new Date(), TOKEN_EXPIRY_MINUTES);

      await db.$transaction([
        db.passwordResetToken.updateMany({
          where: { userId: user.id, used: false },
          data: { used: true },
        }),
        db.passwordResetToken.create({
          data: {
            userId: user.id,
            token: tokenDigest,
            expiresAt,
          },
        }),
      ]);

      const resetLink = `${getBaseUrl().replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (emailError) {
        console.error("Password reset email send failed:", emailError);
        return NextResponse.json(
          {
            error:
              "Password reset email service is not configured correctly. Please contact support.",
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "If the account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    const message = error instanceof Error ? error.message : "";
    if (/password_reset_tokens|passwordResetToken|relation .* does not exist/i.test(message)) {
      return NextResponse.json(
        { error: "Password reset storage is not ready. Please contact support." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Unable to process password reset request." }, { status: 500 });
  }
}
