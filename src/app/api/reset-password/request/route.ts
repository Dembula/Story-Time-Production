import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { issuePasswordReset } from "@/lib/password-reset";
import { validateEmail } from "@/lib/auth-utils";

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

    await issuePasswordReset(email, {
      ip: request.headers.get("x-forwarded-for"),
    });

    return NextResponse.json({
      ok: true,
      message: "If the account exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return NextResponse.json({ error: "Unable to process password reset request." }, { status: 500 });
  }
}
