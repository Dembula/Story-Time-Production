import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import { parseSluglineMeta } from "@/lib/slugline-meta";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as { removeOrphans?: boolean } | null;

  const script = await prisma.projectScript.findFirst({
    where: { projectId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!script) {
    return NextResponse.json({ error: "No project screenplay yet" }, { status: 400 });
  }

  let content = "";
  if (script.currentVersionId) {
    const v = await prisma.projectScriptVersion.findUnique({
      where: { id: script.currentVersionId },
    });
    content = v?.content ?? "";
  }
  if (!content && script.versions[0]) {
    content = script.versions[0].content ?? "";
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "Screenplay has no text to parse" }, { status: 400 });
  }

  const parsed = parseScenesFromScreenplay(content);
  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No scene headings found (use lines starting with INT. or EXT.)" },
      { status: 400 },
    );
  }

  const parsedNumbers = new Set(parsed.map((p) => p.number));

  await prisma.$transaction(async (tx) => {
    for (const { number, heading } of parsed) {
      const { intExt, timeOfDay } = parseSluglineMeta(heading);
      const existing = await tx.projectScene.findFirst({
        where: { scriptId: script.id, number },
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
            scriptId: script.id,
            number,
            heading,
            intExt,
            timeOfDay,
          } as any,
        });
      }
    }

    if (body?.removeOrphans) {
      await tx.projectScene.deleteMany({
        where: {
          scriptId: script.id,
          number: { notIn: [...parsedNumbers] },
        },
      });
    }
  });

  const rows = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  });
  const scenes = rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: row.id,
      number: row.number,
      heading: row.heading,
      scriptId: row.scriptId,
      storyDay: typeof r.storyDay === "number" ? r.storyDay : null,
      intExt: typeof r.intExt === "string" ? r.intExt : null,
      timeOfDay: typeof r.timeOfDay === "string" ? r.timeOfDay : null,
      summary: typeof r.summary === "string" ? r.summary : null,
    };
  });

  return NextResponse.json({ ok: true, count: parsed.length, scenes });
}
