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
  let linkId = role.breakdownCharacterId ?? existingChars[0]?.id ?? null;

  // If this character exists on some scenes, keep those rows and link the role.
  // If it does not exist at all, create one row per project scene so shoot planning
  // can attach the role when those scenes are scheduled.
  if (existingChars.length === 0) {
    const scenes = await db.projectScene.findMany({
      where: { projectId },
      select: { id: true },
      orderBy: { number: "asc" },
    });

    if (scenes.length === 0) {
      const orphan = await db.breakdownCharacter.create({
        data: {
          projectId,
          sceneId: null,
          name: roleName,
          description: null,
          importance: null,
        },
      });
      linkId = orphan.id;
      createdCharacterRows = 1;
    } else {
      for (const scene of scenes) {
        const created = await db.breakdownCharacter.create({
          data: {
            projectId,
            sceneId: scene.id,
            name: roleName,
            description: null,
            importance: null,
          },
        });
        if (!linkId) linkId = created.id;
        createdCharacterRows += 1;
      }
    }
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
