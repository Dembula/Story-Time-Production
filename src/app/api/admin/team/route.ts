import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiPath } from "@/lib/admin-api-auth";
import {
  adminRightsSummary,
  isAdminGodAccount,
  parseAdminRights,
  type AdminRightsMap,
} from "@/lib/admin-permissions";
import { getUserRoles } from "@/lib/user-roles";

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
    const rights = parseAdminRights(user.adminRights);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.userRoles.map((r) => r.role),
      adminRights: rights,
      rightsSummary: adminRightsSummary(rights, user.email),
      isGod: isAdminGodAccount(user.email),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    admins: payload,
    actorIsGod: actor.isGod,
    canManageTeam: actor.isGod || actor.rights.canManageUsers === true,
  });
}
