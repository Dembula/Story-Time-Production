import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isMfaActive } from "@/lib/mfa/login-gate";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      mfaEnabled: true,
      mfaSecretEnc: true,
      mfaPendingSecretEnc: true,
      mfaRecoveryCodesHash: true,
      mfaEnabledAt: true,
      email: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let recoveryCodesRemaining = 0;
  if (user.mfaRecoveryCodesHash) {
    try {
      const hashes = JSON.parse(user.mfaRecoveryCodesHash) as unknown;
      if (Array.isArray(hashes)) recoveryCodesRemaining = hashes.length;
    } catch {
      recoveryCodesRemaining = 0;
    }
  }

  return NextResponse.json({
    enabled: isMfaActive(user),
    pendingSetup: Boolean(user.mfaPendingSecretEnc) && !isMfaActive(user),
    enabledAt: user.mfaEnabledAt?.toISOString() ?? null,
    recoveryCodesRemaining,
    email: user.email,
  });
}
