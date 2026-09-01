import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdminPath,
  hasAdminRight,
  isAdminGodAccount,
  parseAdminRights,
  type AdminRightKey,
  type AdminRightsMap,
} from "@/lib/admin-permissions";

export type AdminApiActor = {
  id: string;
  email: string | null;
  rights: AdminRightsMap | null;
  isGod: boolean;
};

export async function getAdminApiActor(): Promise<AdminApiActor | null> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (role !== "ADMIN" || !id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, adminRights: true },
  });
  const email = user?.email ?? session?.user?.email ?? null;
  return {
    id,
    email,
    rights: user?.adminRights === null || user?.adminRights === undefined ? null : parseAdminRights(user.adminRights),
    isGod: isAdminGodAccount(email),
  };
}

export async function requireAdminApiActor(): Promise<AdminApiActor | { error: string; status: number }> {
  const actor = await getAdminApiActor();
  if (!actor) return { error: "Forbidden", status: 403 };
  return actor;
}

export function actorHasAdminRight(actor: AdminApiActor, key: AdminRightKey): boolean {
  return hasAdminRight(actor.rights, key, { email: actor.email, isAdminRole: true });
}

export async function requireAdminApiPath(path: string): Promise<AdminApiActor | { error: string; status: number }> {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return actor;
  if (!canAccessAdminPath(path, actor.rights, { email: actor.email, isAdminRole: true })) {
    return { error: "You do not have access to this admin section.", status: 403 };
  }
  return actor;
}
