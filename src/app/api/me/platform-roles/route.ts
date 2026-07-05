import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildPlatformRoleOptions } from "@/lib/platform-roles-shared";
import { loadUserPlatformRoles } from "@/lib/platform-roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeRole = (session.user as { role?: string }).role ?? null;
  const roles = await loadUserPlatformRoles(userId, activeRole);

  return NextResponse.json({
    activeRole,
    roles,
    options: buildPlatformRoleOptions(roles),
    multiRole: roles.length > 1,
  });
}
