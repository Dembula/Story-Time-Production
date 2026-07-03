import { prisma } from "@/lib/prisma";
import { ensureCastingRoleLinkedToScenes } from "@/lib/casting-scene-link";

export type CastingSyncResult = { created: number; skipped: number; relinked: number };

/**
 * Create casting roles from breakdown characters and (re)link every role to
 * breakdown scene rows. Safe to run repeatedly — it is idempotent by
 * breakdownCharacterId and case-insensitive role name.
 *
 * This must run after AI breakdown re-populates, because the breakdown wipe
 * (deleteMany on BreakdownCharacter) SetNulls CastingRole.breakdownCharacterId,
 * silently unlinking cast from scenes until a re-sync happens.
 */
export async function syncCastingRolesFromBreakdown(
  projectId: string,
): Promise<CastingSyncResult> {
  const characters = await prisma.breakdownCharacter.findMany({
    where: { projectId },
    select: { id: true, name: true, description: true, importance: true },
  });

  const existingRoles = await prisma.castingRole.findMany({
    where: { projectId },
    select: { id: true, name: true, breakdownCharacterId: true },
  });

  const existingByCharacterId = new Set(
    existingRoles.map((r) => r.breakdownCharacterId).filter((id): id is string => !!id),
  );
  const existingByName = new Set(existingRoles.map((r) => r.name.toLowerCase()));

  let created = 0;
  let skipped = 0;
  const seenNames = new Set<string>();

  for (const ch of characters) {
    const name = ch.name?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    const lower = name.toLowerCase();
    // Breakdown creates one row per scene per character — only one role per name.
    if (seenNames.has(lower)) {
      skipped++;
      continue;
    }
    seenNames.add(lower);

    if (existingByCharacterId.has(ch.id) || existingByName.has(lower)) {
      skipped++;
      continue;
    }

    const role = await prisma.castingRole.create({
      data: {
        projectId,
        name,
        description: ch.description ?? null,
        importance: ch.importance ?? null,
        breakdownCharacterId: ch.id,
      },
    });
    await ensureCastingRoleLinkedToScenes(prisma, projectId, role);
    created++;
  }

  // Re-link every pre-existing role. Vital after breakdown re-runs which
  // SetNull the character link on all roles.
  let relinked = 0;
  for (const role of existingRoles) {
    const result = await ensureCastingRoleLinkedToScenes(prisma, projectId, {
      id: role.id,
      name: role.name,
      breakdownCharacterId: role.breakdownCharacterId,
    });
    if (result.breakdownCharacterId !== role.breakdownCharacterId) relinked++;
  }

  return { created, skipped, relinked };
}
