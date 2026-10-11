import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptMfaSecret } from "@/lib/mfa/crypto";
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyTotpCode,
} from "@/lib/mfa/totp";
import { isMfaActive } from "@/lib/mfa/login-gate";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mfaEnabled: true,
      mfaSecretEnc: true,
      mfaPendingSecretEnc: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (isMfaActive(user)) {
    return NextResponse.json({ error: "Authenticator MFA is already enabled." }, { status: 400 });
  }
  if (!user.mfaPendingSecretEnc) {
    return NextResponse.json(
      { error: "No MFA setup in progress. Start setup again." },
      { status: 400 },
    );
  }

  let secret: string;
  try {
    secret = decryptMfaSecret(user.mfaPendingSecretEnc);
  } catch {
    return NextResponse.json({ error: "Could not read pending MFA secret. Start setup again." }, { status: 500 });
  }

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: "Invalid authenticator code. Try again." }, { status: 400 });
  }

  const recoveryCodes = generateRecoveryCodes(8);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
      mfaSecretEnc: user.mfaPendingSecretEnc,
      mfaPendingSecretEnc: null,
      mfaRecoveryCodesHash: hashRecoveryCodes(recoveryCodes),
      mfaEnabledAt: new Date(),
    },
  });

  return NextResponse.json({
    enabled: true,
    recoveryCodes,
  });
}
