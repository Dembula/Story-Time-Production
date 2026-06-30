import { prisma } from "@/lib/prisma";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import { parseSluglineMeta } from "@/lib/slugline-meta";

export type PublishCreatorScriptResult = {
  projectScriptId: string;
  scenesSynced: number;
  scenes: Array<{
    id: string;
    number: string;
    heading: string | null;
    storyDay: number | null;
    intExt: string | null;
    timeOfDay: string | null;
    summary: string | null;
  }>;
};

/** Copy a linked CreatorScript into the canonical ProjectScript and refresh ProjectScene rows. */
export async function publishCreatorScriptToProject(params: {
  projectId: string;
  creatorScriptId: string;
  userId: string;
}): Promise<PublishCreatorScriptResult | null> {
  const cs = await prisma.creatorScript.findFirst({
    where: { id: params.creatorScriptId, projectId: params.projectId },
  });
  if (!cs) return null;

  let script = await prisma.projectScript.findFirst({ where: { projectId: params.projectId } });
  if (!script) {
    script = await prisma.projectScript.create({
      data: { projectId: params.projectId, title: cs.title },
    });
  } else {
    await prisma.projectScript.update({
      where: { id: script.id },
      data: { title: cs.title },
    });
  }

  const latest = await prisma.projectScriptVersion.findFirst({
    where: { scriptId: script.id },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    await prisma.projectScriptVersion.update({
      where: { id: latest.id },
      data: { content: cs.content, autoSavedAt: new Date() },
    });
    await prisma.projectScript.update({
      where: { id: script.id },
      data: { currentVersionId: latest.id },
    });
  } else {
    const v = await prisma.projectScriptVersion.create({
      data: {
        scriptId: script.id,
        content: cs.content,
        createdById: params.userId,
        autoSavedAt: new Date(),
      },
    });
    await prisma.projectScript.update({
      where: { id: script.id },
      data: { currentVersionId: v.id },
    });
  }

  const parsed = parseScenesFromScreenplay(cs.content);
  if (parsed.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { number, heading } of parsed) {
        const { intExt, timeOfDay } = parseSluglineMeta(heading);
        const existing = await tx.projectScene.findFirst({
          where: { scriptId: script.id, number },
        });
        if (existing) {
          await tx.projectScene.update({
            where: { id: existing.id },
            data: { heading, intExt, timeOfDay } as Record<string, unknown>,
          });
        } else {
          await tx.projectScene.create({
            data: {
              projectId: params.projectId,
              scriptId: script.id,
              number,
              heading,
              intExt,
              timeOfDay,
            } as Record<string, unknown>,
          });
        }
      }
    });
  }

  const sceneRows = await prisma.projectScene.findMany({
    where: { projectId: params.projectId },
    orderBy: { number: "asc" },
  });

  return {
    projectScriptId: script.id,
    scenesSynced: parsed.length,
    scenes: sceneRows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: row.id,
        number: row.number,
        heading: row.heading,
        storyDay: typeof r.storyDay === "number" ? r.storyDay : null,
        intExt: typeof r.intExt === "string" ? r.intExt : null,
        timeOfDay: typeof r.timeOfDay === "string" ? r.timeOfDay : null,
        summary: typeof r.summary === "string" ? r.summary : null,
      };
    }),
  };
}
