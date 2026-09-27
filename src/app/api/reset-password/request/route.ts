import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { issuePasswordReset } from "@/lib/password-reset";
import { validateEmail } from "@/lib/auth-utils";
import { getClientIpFromRequest } from "@/lib/auth-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIpFromRequest(request);

  const ipRate = await checkRateLimit({
    key: "reset-password-request",
    ip,
    maxAttempts: 5,
    windowMs: WINDOW_MS,
  });
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
      },
    );
  }

  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || "";

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    const emailRate = await checkRateLimit({
      key: "reset-password-request-email",
      ip: email,
      maxAttempts: 3,
      windowMs: WINDOW_MS,
    });
    if (!emailRate.allowed) {
      return NextResponse.json(
        { error: "Too many reset requests for this email. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(emailRate.retryAfterSeconds) },
        },
      );
    }

    await issuePasswordReset(email, { ip });

    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for that email, a reset link has been sent. Check inbox and spam, and use the exact email you signed up with.",
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return NextResponse.json({ error: "Unable to process password reset request." }, { status: 500 });
  }
}
