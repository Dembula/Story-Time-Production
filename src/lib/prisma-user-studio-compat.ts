import { prisma } from "@/lib/prisma";
import { isMissingUserStudioWorkspacePrismaField } from "@/lib/prisma-missing-table";

const CREDENTIALS_USER_SELECT_BASE = {
  id: true,
  email: true,
  name: true,
  role: true,
  passwordHash: true,
  image: true,
} as const;

export type CredentialsUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  passwordHash: string | null;
  image: string | null;
  activeCreatorStudioProfileId: string | null;
};

/** Credentials login: load user with active profile id when the Prisma client supports it. */
export async function findUserForCredentialsLogin(emailLower: string): Promise<CredentialsUserRow | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { ...CREDENTIALS_USER_SELECT_BASE, activeCreatorStudioProfileId: true },
    });
    return user as CredentialsUserRow | null;
  } catch (e) {
    if (isMissingUserStudioWorkspacePrismaField(e)) {
      const user = await prisma.user.findUnique({
        where: { email: emailLower },
        select: { ...CREDENTIALS_USER_SELECT_BASE },
      });
      if (!user) return null;
      return { ...user, activeCreatorStudioProfileId: null };
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
