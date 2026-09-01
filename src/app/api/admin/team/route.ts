import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiPath } from "@/lib/admin-api-auth";
import {
  adminRightsSummary,
  isAdminGodAccount,
  parseAdminRights,
  hasAdminRight,
} from "@/lib/admin-permissions";

export async function GET() {
  const actor = await requireAdminApiPath("/api/admin/team");
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const adminUsers = await prisma.user.findMany({
    where: {
      OR: [{ role: "ADMIN" }, { userRoles: { some: { role: "ADMIN" } } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRights: true,
      createdAt: true,
      updatedAt: true,
      userRoles: { select: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = adminUsers.map((user) => {
    const rights =
      user.adminRights === null || user.adminRights === undefined
        ? null
        : parseAdminRights(user.adminRights);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.userRoles.map((r) => r.role),
      adminRights: rights,
      rightsSummary: adminRightsSummary(user.adminRights, user.email),
      isGod: isAdminGodAccount(user.email),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    admins: payload,
    actorIsGod: actor.isGod,
    canManageTeam:
      actor.isGod ||
      hasAdminRight(actor.rights, "canManageUsers", { email: actor.email, isAdminRole: true }),
  });
}
