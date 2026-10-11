import { prisma } from "@/lib/prisma";
import { decryptMfaSecret } from "@/lib/mfa/crypto";
import { consumeRecoveryCode, verifyTotpCode } from "@/lib/mfa/totp";

export type MfaLoginFields = {
  mfaEnabled: boolean;
  mfaSecretEnc: string | null;
  mfaRecoveryCodesHash?: string | null;
};

/** True only when MFA is fully activated (not pending setup). */
export function isMfaActive(
  user: Pick<MfaLoginFields, "mfaEnabled" | "mfaSecretEnc"> | null | undefined,
): boolean {
  return Boolean(user?.mfaEnabled && user.mfaSecretEnc);
}

/**
 * After password succeeds: if MFA is active, require a valid TOTP or recovery code.
 * If MFA is not active, always pass (ignore any presented code).
 */
export async function assertMfaForCredentialsLogin(args: {
  userId: string;
  mfa: MfaLoginFields;
  mfaCodeRaw: unknown;
}): Promise<boolean> {
  if (!isMfaActive(args.mfa)) return true;

  const presented =
    typeof args.mfaCodeRaw === "string" ? args.mfaCodeRaw.trim() : "";
  if (!presented) return false;

  let secret: string;
  try {
    secret = decryptMfaSecret(args.mfa.mfaSecretEnc!);
  } catch {
    return false;
  }

  if (verifyTotpCode(secret, presented)) return true;

  const recovery = consumeRecoveryCode(args.mfa.mfaRecoveryCodesHash, presented);
  if (!recovery.ok) return false;

  await prisma.user.update({
    where: { id: args.userId },
    data: { mfaRecoveryCodesHash: recovery.remainingJson },
  });
  return true;
}

export function readMfaCodeFromCredentials(
  credentials: Record<string, unknown> | undefined,
): unknown {
  return credentials?.mfaCode;
}
