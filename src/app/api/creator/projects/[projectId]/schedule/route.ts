import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

function parseScenesFromScript(content: string): { number: string; heading: string | null }[] {
  const lines = content.split(/\r?\n/);
  const scenes: { number: string; heading: string | null }[] = [];
  let sceneNumber = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(INT\.|EXT\.)/i.test(trimmed)) {
      scenes.push({
        number: `${sceneNumber}`,
        heading: trimmed,
      });
      sceneNumber += 1;
    }
  }
  return scenes;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const [shootDays, scenes] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId: params.projectId },
      orderBy: { date: "asc" },
      include: { scenes: { orderBy: { order: "asc" } } },
    }),
    prisma.projectScene.findMany({
      where: { projectId: params.projectId },
      orderBy: { number: "asc" },
    }),
  ]);

  const scenesById = new Map(scenes.map((s) => [s.id, s]));

  return NextResponse.json({
    shootDays: shootDays.map((d) => ({
      ...d,
      scenes: d.scenes.map((link) => ({
        id: `${d.id}-${link.sceneId}`,
        order: link.order,
        scene: scenesById.get(link.sceneId) ?? null,
      })),
    })),
    scenes,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        date?: string;
      }
    | null;

  const dateIso = body?.date ?? new Date().toISOString();
  const day = await prisma.shootDay.create({
    data: {
      projectId: params.projectId,
      date: new Date(dateIso),
      status: "PLANNED",
    },
  });
  return NextResponse.json({ day }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const access = await ensureAccess(params.projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        days: {
          id: string;
          date: string;
          unit: string | null;
          callTime: string | null;
          wrapTime: string | null;
          locationSummary: string | null;
          status: string;
          scenesBeingShot?: string | null;
          scenes: { sceneId: string; order: number }[];
        }[];
      }
    | null;

  if (!body?.days) {
    return NextResponse.json({ error: "Missing days" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const d of body.days) {
      await tx.shootDay.updateMany({
        where: { id: d.id, projectId: params.projectId },
        data: {
          date: new Date(d.date),
          unit: d.unit ?? null,
          callTime: d.callTime ?? null,
          wrapTime: d.wrapTime ?? null,
          status: d.status,
          locationSummary: d.locationSummary ?? null,
        },
      });

      await tx.shootDayScene.deleteMany({
        where: { shootDayId: d.id },
      });

      if (Array.isArray(d.scenes) && d.scenes.length > 0) {
        await tx.shootDayScene.createMany({
          data: d.scenes.map((s) => ({
            shootDayId: d.id,
            sceneId: s.sceneId,
            order: s.order,
          })),
        });
      }
    }
  });

  const [shootDays, scenes] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId: params.projectId },
      orderBy: { date: "asc" },
      include: { scenes: { orderBy: { order: "asc" } } },
    }),
    prisma.projectScene.findMany({
      where: { projectId: params.projectId },
      orderBy: { number: "asc" },
    }),
  ]);

  const scenesById = new Map(scenes.map((s) => [s.id, s]));

  return NextResponse.json({
    shootDays: shootDays.map((d) => ({
      ...d,
      scenes: d.scenes.map((link) => ({
        id: `${d.id}-${link.sceneId}`,
        order: link.order,
        scene: scenesById.get(link.sceneId) ?? null,
      })),
    })),
    scenes,
  });
}
