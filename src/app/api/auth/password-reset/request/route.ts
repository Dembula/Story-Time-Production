import { NextRequest, NextResponse } from "next/server";
import { issuePasswordReset } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    await issuePasswordReset(email);
    return NextResponse.json({
      ok: true,
      message: "If this account exists, a reset link has been sent to the email address.",
    });
  } catch (error) {
    console.error("Password reset request failed:", error);
    return NextResponse.json({ error: "Unable to process reset request." }, { status: 500 });
  }
}
