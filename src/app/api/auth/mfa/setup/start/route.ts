import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import QRCode from "qrcode";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptMfaSecret } from "@/lib/mfa/crypto";
import { buildOtpauthUri, generateTotpSecret } from "@/lib/mfa/totp";
import { isMfaActive } from "@/lib/mfa/login-gate";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      mfaEnabled: true,
      mfaSecretEnc: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (isMfaActive(user)) {
    return NextResponse.json(
      { error: "Authenticator MFA is already enabled on this account." },
      { status: 400 },
    );
  }

  const secret = generateTotpSecret();
  const accountName = user.email?.trim() || session.user.email || "Story Time account";
  const otpauthUrl = buildOtpauthUri({ secretBase32: secret, accountName });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaPendingSecretEnc: encryptMfaSecret(secret),
    },
  });

  return NextResponse.json({
    otpauthUrl,
    qrDataUrl,
    secret,
  });
}
