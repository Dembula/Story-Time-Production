import { prisma } from "@/lib/prisma";
import { deleteContentGraphEdges, upsertKnowledgeEdge } from "./upsert-edge";
import { slugEntityId } from "./utils";

/** Sync breakdown cast roster + distribution/festival/rights for a production project. */
export async function syncProjectKnowledgeGraph(projectId: string): Promise<number> {
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return 0;

  const linkedContent = await prisma.content.findFirst({
    where: { linkedProjectId: projectId },
    select: { id: true },
  });

  let edgeCount = 0;
  const contentId = linkedContent?.id ?? null;
  if (contentId) {
    await upsertKnowledgeEdge({
      fromType: "content",
      fromId: contentId,
      toType: "project",
      toId: projectId,
      relation: "linked_project",
      label: project.title,
      contentId,
    });
    edgeCount++;
  }

  const [characters, castingRoles, distributions] = await Promise.all([
    prisma.breakdownCharacter.findMany({
      where: { projectId },
      select: { id: true, name: true, importance: true, description: true },
    }),
    prisma.castingRole.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        breakdownCharacterId: true,
        breakdownCharacter: { select: { name: true } },
        invitations: {
          where: { status: "ACCEPTED" },
          take: 1,
          select: { talent: { select: { name: true } } },
        },
      },
    }),
    prisma.distributionSubmission.findMany({
      where: { projectId },
      select: { id: true, target: true, territories: true, rights: true, status: true },
    }),
  ]);

  for (const character of characters) {
    const charId = character.id;
    await upsertKnowledgeEdge({
      fromType: "project",
      fromId: projectId,
      toType: "character",
      toId: charId,
      relation: "has_character",
      label: character.name,
      contentId,
      metadata: { importance: character.importance },
    });
    edgeCount++;

    if (contentId) {
      const actorId = slugEntityId(character.name);
      await upsertKnowledgeEdge({
        fromType: "content",
        fromId: contentId,
        toType: "character",
        toId: charId,
        relation: "has_character",
        label: character.name,
        contentId,
      });
      await upsertKnowledgeEdge({
        fromType: "character",
        fromId: charId,
        toType: "actor",
        toId: actorId,
        relation: "played_by",
        label: character.name,
        contentId,
        metadata: { source: "breakdown" },
      });
      edgeCount += 2;
    }
  }

  for (const role of castingRoles) {
    const talentName =
      role.invitations[0]?.talent?.name ?? role.breakdownCharacter?.name ?? role.name;
    if (!talentName?.trim()) continue;

    const actorId = slugEntityId(talentName);
    await upsertKnowledgeEdge({
      fromType: "project",
      fromId: projectId,
      toType: "cast_role",
      toId: role.id,
      relation: "cast_in",
      label: role.name,
      contentId,
    });
    await upsertKnowledgeEdge({
      fromType: "cast_role",
      fromId: role.id,
      toType: "actor",
      toId: actorId,
      relation: "played_by",
      label: talentName,
      contentId,
    });
    edgeCount += 2;

    if (contentId) {
      await upsertKnowledgeEdge({
        fromType: "content",
        fromId: contentId,
        toType: "actor",
        toId: actorId,
        relation: "features_actor",
        label: talentName,
        contentId,
        weight: 1.2,
        metadata: { source: "casting_roster" },
      });
      edgeCount++;
    }
  }

  for (const dist of distributions) {
    const target = dist.target.trim();
    const isFestival = /fest|festival|market|sundance|cannes|berlin|toronto|durban/i.test(target);

    if (isFestival) {
      const festivalId = slugEntityId(target);
      await upsertKnowledgeEdge({
        fromType: "project",
        fromId: projectId,
        toType: "festival",
        toId: festivalId,
        relation: "submitted_to",
        label: target,
        contentId,
        metadata: { status: dist.status },
      });
      edgeCount++;

      if (contentId) {
        await upsertKnowledgeEdge({
          fromType: "content",
          fromId: contentId,
          toType: "festival",
          toId: festivalId,
          relation: "submitted_to",
          label: target,
          contentId,
          metadata: { status: dist.status },
        });
        edgeCount++;
      }
    }

    if (dist.rights?.trim() || dist.territories?.trim()) {
      const rightsLabel = [dist.rights, dist.territories].filter(Boolean).join(" · ");
      const rightsId = slugEntityId(rightsLabel);
      await upsertKnowledgeEdge({
        fromType: "project",
        fromId: projectId,
        toType: "rights",
        toId: rightsId,
        relation: "has_rights",
        label: rightsLabel,
        contentId,
        metadata: { target, status: dist.status },
      });
      edgeCount++;

      if (contentId) {
        await upsertKnowledgeEdge({
          fromType: "content",
          fromId: contentId,
          toType: "rights",
          toId: rightsId,
          relation: "has_rights",
          label: rightsLabel,
          contentId,
        });
        edgeCount++;
      }
    }
  }

  return edgeCount;
}

/** Sync project graph for all projects linked to published content. */
export async function syncAllProjectGraphs(limit = 100): Promise<{ projects: number; edges: number }> {
  const linked = await prisma.content.findMany({
    where: { published: true, linkedProjectId: { not: null } },
    select: { linkedProjectId: true },
    distinct: ["linkedProjectId"],
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const projectIds = linked
    .map((c) => c.linkedProjectId)
    .filter((id): id is string => Boolean(id));

  let edges = 0;
  for (const id of projectIds) {
    edges += await syncProjectKnowledgeGraph(id);
  }
  return { projects: projectIds.length, edges };
}
