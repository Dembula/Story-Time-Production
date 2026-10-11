import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptMfaSecret } from "@/lib/mfa/crypto";
import { consumeRecoveryCode, verifyTotpCode } from "@/lib/mfa/totp";
import { isMfaActive } from "@/lib/mfa/login-gate";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: unknown; code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!password || !code) {
    return NextResponse.json(
      { error: "Password and authenticator (or recovery) code are required to disable MFA." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      passwordHash: true,
      mfaEnabled: true,
      mfaSecretEnc: true,
      mfaRecoveryCodesHash: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!isMfaActive(user)) {
    return NextResponse.json({ error: "MFA is not enabled." }, { status: 400 });
  }
  if (!user.passwordHash) {
    return NextResponse.json({ error: "Set a password before changing MFA." }, { status: 400 });
  }

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
  }

  let secret: string;
  try {
    secret = decryptMfaSecret(user.mfaSecretEnc!);
  } catch {
    return NextResponse.json({ error: "Could not verify MFA secret." }, { status: 500 });
  }

  const totpOk = verifyTotpCode(secret, code);
  if (!totpOk) {
    const recovery = consumeRecoveryCode(user.mfaRecoveryCodesHash, code);
    if (!recovery.ok) {
      return NextResponse.json({ error: "Invalid authenticator or recovery code." }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: false,
      mfaSecretEnc: null,
      mfaPendingSecretEnc: null,
      mfaRecoveryCodesHash: null,
      mfaEnabledAt: null,
    },
  });

  return NextResponse.json({ enabled: false });
}
