import type { PrismaClient } from "../../generated/prisma";

type Db = PrismaClient | any;

/**
 * Ensure a casting role is linked to project breakdown characters for shoot-day planning.
 * Links by character name so schedule "Cast required" can resolve actors for scenes.
 */
export async function ensureCastingRoleLinkedToScenes(
  db: Db,
  projectId: string,
  role: { id: string; name: string; breakdownCharacterId?: string | null },
): Promise<{ breakdownCharacterId: string | null; createdCharacterRows: number }> {
  const roleName = role.name.trim();
  if (!roleName) {
    return { breakdownCharacterId: role.breakdownCharacterId ?? null, createdCharacterRows: 0 };
  }

  const existingChars = await db.breakdownCharacter.findMany({
    where: {
      projectId,
      name: { equals: roleName, mode: "insensitive" },
    },
    select: { id: true, sceneId: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  let createdCharacterRows = 0;
  // Prefer an existing row (any scene). Never clone the character onto every scene —
  // one identity per name; scene appearances come from breakdown, not casting.
  let linkId =
    (role.breakdownCharacterId &&
    existingChars.some((c: { id: string }) => c.id === role.breakdownCharacterId)
      ? role.breakdownCharacterId
      : null) ??
    existingChars[0]?.id ??
    null;

  if (existingChars.length === 0) {
    const created = await db.breakdownCharacter.create({
      data: {
        projectId,
        sceneId: null,
        name: roleName,
        description: null,
        importance: null,
      },
    });
    linkId = created.id;
    createdCharacterRows = 1;
  }

  if (linkId && linkId !== role.breakdownCharacterId) {
    await db.castingRole.update({
      where: { id: role.id },
      data: { breakdownCharacterId: linkId },
    });
  }

  return { breakdownCharacterId: linkId, createdCharacterRows };
}

/** Backfill links for all casting roles on a project. */
export async function ensureAllCastingRolesLinkedToScenes(
  db: Db,
  projectId: string,
): Promise<number> {
  const roles = await db.castingRole.findMany({
    where: { projectId },
    select: { id: true, name: true, breakdownCharacterId: true },
  });
  let touched = 0;
  for (const role of roles) {
    const result = await ensureCastingRoleLinkedToScenes(db, projectId, role);
    touched += result.createdCharacterRows;
    if (result.breakdownCharacterId && result.breakdownCharacterId !== role.breakdownCharacterId) {
      touched += 1;
    }
  }
  return touched;
}
