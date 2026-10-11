import { prisma } from "@/lib/prisma";
import { isMissingUserStudioWorkspacePrismaField } from "@/lib/prisma-missing-table";

const CREDENTIALS_USER_SELECT_BASE = {
  id: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
  image: true,
  mfaEnabled: true,
  mfaSecretEnc: true,
  mfaRecoveryCodesHash: true,
} as const;

export type CredentialsUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  passwordHash: string | null;
  image: string | null;
  activeCreatorStudioProfileId: string | null;
  mfaEnabled: boolean;
  mfaSecretEnc: string | null;
  mfaRecoveryCodesHash: string | null;
};

function withMfaDefaults<T extends { mfaEnabled?: boolean; mfaSecretEnc?: string | null; mfaRecoveryCodesHash?: string | null }>(
  user: T,
): T & { mfaEnabled: boolean; mfaSecretEnc: string | null; mfaRecoveryCodesHash: string | null } {
  return {
    ...user,
    mfaEnabled: Boolean(user.mfaEnabled),
    mfaSecretEnc: user.mfaSecretEnc ?? null,
    mfaRecoveryCodesHash: user.mfaRecoveryCodesHash ?? null,
  };
}

function isMissingMfaField(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /mfaEnabled|mfaSecretEnc|mfaRecoveryCodesHash|mfaPendingSecretEnc|mfaEnabledAt/i.test(msg);
}

/** Credentials login: load user with active profile id when the Prisma client supports it. */
export async function findUserForCredentialsLogin(emailLower: string): Promise<CredentialsUserRow | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { ...CREDENTIALS_USER_SELECT_BASE, activeCreatorStudioProfileId: true },
    });
    return user ? (withMfaDefaults(user) as CredentialsUserRow) : null;
  } catch (e) {
    if (isMissingUserStudioWorkspacePrismaField(e)) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: emailLower },
          select: { ...CREDENTIALS_USER_SELECT_BASE },
        });
        if (!user) return null;
        return { ...withMfaDefaults(user), activeCreatorStudioProfileId: null };
      } catch (inner) {
        if (isMissingMfaField(inner)) {
          const user = await prisma.user.findUnique({
            where: { email: emailLower },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
              image: true,
            },
          });
          if (!user) return null;
          return {
            ...user,
            activeCreatorStudioProfileId: null,
            mfaEnabled: false,
            mfaSecretEnc: null,
            mfaRecoveryCodesHash: null,
          };
        }
        throw inner;
      }
    }
    if (isMissingMfaField(e)) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: emailLower },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            image: true,
            activeCreatorStudioProfileId: true,
          },
        });
        if (!user) return null;
        return {
          ...user,
          mfaEnabled: false,
          mfaSecretEnc: null,
          mfaRecoveryCodesHash: null,
        };
      } catch (inner) {
        if (isMissingUserStudioWorkspacePrismaField(inner)) {
          const user = await prisma.user.findUnique({
            where: { email: emailLower },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
              image: true,
            },
          });
          if (!user) return null;
          return {
            ...user,
            activeCreatorStudioProfileId: null,
            mfaEnabled: false,
            mfaSecretEnc: null,
            mfaRecoveryCodesHash: null,
          };
        }
        throw inner;
      }
    }
    throw e;
  }
}

export async function findUserActiveStudioProfileId(userId: string): Promise<string | null> {
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeCreatorStudioProfileId: true },
    });
    return row?.activeCreatorStudioProfileId ?? null;
  } catch (e) {
    if (isMissingUserStudioWorkspacePrismaField(e)) return null;
    throw e;
  }
}
