import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import { parseSluglineMeta } from "@/lib/slugline-meta";

/** Copy a linked CreatorScript into the canonical ProjectScript and refresh ProjectScene rows. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as { creatorScriptId?: string } | null;
  if (!body?.creatorScriptId) {
    return NextResponse.json({ error: "Missing creatorScriptId" }, { status: 400 });
  }

  const cs = await prisma.creatorScript.findFirst({
    where: { id: body.creatorScriptId, projectId },
  });
  if (!cs) {
    return NextResponse.json({ error: "Script not found for this project" }, { status: 404 });
  }

  let script = await prisma.projectScript.findFirst({ where: { projectId } });
  if (!script) {
    script = await prisma.projectScript.create({
      data: { projectId, title: cs.title },
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
        createdById: userId,
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
          where: { scriptId: script!.id, number },
        });
        if (existing) {
          await tx.projectScene.update({
            where: { id: existing.id },
            data: { heading, intExt, timeOfDay } as any,
          });
        } else {
          await tx.projectScene.create({
            data: {
              projectId,
              scriptId: script!.id,
              number,
              heading,
              intExt,
              timeOfDay,
            } as any,
          });
        }
      }
    });
  }

  const sceneRows = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  });
  const scenes = sceneRows.map((row) => {
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
  });

  return NextResponse.json({
    ok: true,
    projectScriptId: script.id,
    scenesSynced: parsed.length,
    scenes,
  });
}
