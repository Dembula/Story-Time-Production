import { prisma } from "@/lib/prisma";

export {
  ALL_PLATFORM_ROLES,
  CREATOR_ROLES,
  ADMIN_ROLES,
  VIEWER_ROLES,
  userHasPlatformRole,
  type PlatformRole,
} from "@/lib/user-roles-shared";

export async function getUserRoles(userId: string, fallbackRole?: string | null): Promise<Set<string>> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  if (rows.length > 0) {
    return new Set(rows.map((row) => row.role));
  }
  return new Set([fallbackRole ?? "SUBSCRIBER"]);
}

export async function ensureUserRole(userId: string, role: string): Promise<void> {
  const normalizedRole = role.trim().toUpperCase();
  if (!normalizedRole) return;
  await prisma.userRole.upsert({
    where: { userId_role: { userId, role: normalizedRole } },
    update: {},
    create: { userId, role: normalizedRole },
  });
}

export async function replaceUserRoles(userId: string, roles: string[]): Promise<string[]> {
  const normalized = Array.from(
    new Set(
      roles
        .map((role) => role.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  const finalRoles = normalized.length > 0 ? normalized : ["SUBSCRIBER"];
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: finalRoles.map((role) => ({ userId, role })),
      skipDuplicates: true,
    }),
  ]);
  return finalRoles;
}
