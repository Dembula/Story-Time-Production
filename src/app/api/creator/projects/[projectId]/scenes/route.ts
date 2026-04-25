import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

function sceneApiShape(s: unknown) {
  const r = s as Record<string, unknown>;
  return {
    id: String(r.id),
    number: String(r.number),
    heading: (r.heading as string | null) ?? null,
    storyDay: typeof r.storyDay === "number" ? r.storyDay : null,
    intExt: typeof r.intExt === "string" ? r.intExt : null,
    timeOfDay: typeof r.timeOfDay === "string" ? r.timeOfDay : null,
    summary: typeof r.summary === "string" ? r.summary : null,
    status: String(r.status),
    scriptId: typeof r.scriptId === "string" ? r.scriptId : null,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const rows = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  });

  return NextResponse.json({ scenes: rows.map(sceneApiShape) });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as {
    scenes?: Array<{
      id: string;
      storyDay?: number | null;
      intExt?: string | null;
      timeOfDay?: string | null;
      summary?: string | null;
      heading?: string | null;
    }>;
  } | null;

  if (!body?.scenes?.length) {
    return NextResponse.json({ error: "scenes array required" }, { status: 400 });
  }

  for (const s of body.scenes) {
    if (!s.id) continue;
    const row = await prisma.projectScene.findFirst({
      where: { id: s.id, projectId },
      select: { id: true },
    });
    if (!row) {
      return NextResponse.json({ error: `Scene not found: ${s.id}` }, { status: 404 });
    }
    const data: Record<string, unknown> = {};
    if ("storyDay" in s) data.storyDay = s.storyDay;
    if ("intExt" in s) data.intExt = s.intExt;
    if ("timeOfDay" in s) data.timeOfDay = s.timeOfDay;
    if ("summary" in s) data.summary = s.summary;
    if ("heading" in s) data.heading = s.heading;
    if (Object.keys(data).length > 0) {
      await prisma.projectScene.update({ where: { id: s.id }, data: data as any });
    }
  }

  const rows = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  });

  return NextResponse.json({ ok: true, scenes: rows.map(sceneApiShape) });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as { targetSceneCount?: number } | null;
  const parsedCount = Number(body?.targetSceneCount ?? 0);
  const targetSceneCount = Number.isFinite(parsedCount) ? Math.max(0, Math.floor(parsedCount)) : 0;

  if (targetSceneCount <= 0) {
    return NextResponse.json({ error: "targetSceneCount must be greater than zero" }, { status: 400 });
  }

  const existing = await prisma.projectScene.findMany({
    where: { projectId },
    select: { id: true, number: true },
  });

  const existingByNumber = new Map<string, string>();
  for (const s of existing) {
    const normalized = (s.number ?? "").trim();
    if (normalized) existingByNumber.set(normalized, s.id);
  }

  const toCreate: { projectId: string; number: string; heading: string }[] = [];
  for (let n = 1; n <= targetSceneCount; n += 1) {
    const number = String(n);
    if (!existingByNumber.has(number)) {
      toCreate.push({
        projectId,
        number,
        heading: `SCENE ${number}`,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.projectScene.createMany({ data: toCreate });
  }

  const rows = await prisma.projectScene.findMany({
    where: { projectId },
    orderBy: { number: "asc" },
  });

  return NextResponse.json({
    ok: true,
    createdCount: toCreate.length,
    targetSceneCount,
    scenes: rows.map(sceneApiShape),
  });
}
