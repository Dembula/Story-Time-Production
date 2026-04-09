import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

const sceneScheduleInclude = {
  script: { select: { id: true, title: true } },
  primaryLocation: { select: { id: true, name: true, description: true } },
  breakdownCharacters: {
    select: { id: true, name: true, description: true, importance: true },
    orderBy: { name: "asc" as const },
  },
  breakdownProps: {
    select: { id: true, name: true, description: true, special: true },
    orderBy: { name: "asc" as const },
  },
  breakdownLocations: {
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" as const },
  },
  breakdownWardrobes: {
    select: { id: true, description: true, character: true },
    orderBy: { description: "asc" as const },
  },
  breakdownExtras: {
    select: { id: true, description: true, quantity: true },
  },
  breakdownVehicles: {
    select: { id: true, description: true, stuntRelated: true },
  },
  breakdownStunts: {
    select: { id: true, description: true, safetyNotes: true },
  },
  breakdownSfxs: {
    select: { id: true, description: true, practical: true },
  },
} as const;

async function loadSchedulePayload(projectId: string) {
  const script = await prisma.projectScript.findFirst({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      _count: { select: { scenes: true } },
    },
  });

  const [shootDays, scenes] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      include: {
        scenes: { orderBy: { order: "asc" } },
      },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
      include: sceneScheduleInclude,
    }),
  ]);

  const scenesById = new Map(scenes.map((s) => [s.id, s]));

  return {
    script: script
      ? { id: script.id, title: script.title, sceneCount: script._count.scenes }
      : null,
    shootDays: shootDays.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      unit: d.unit,
      callTime: d.callTime,
      wrapTime: d.wrapTime,
      status: d.status,
      locationSummary: d.locationSummary,
      scenesBeingShot: d.scenesBeingShot,
      dayNotes: d.dayNotes,
      scenes: d.scenes.map((link) => ({
        id: `${d.id}-${link.sceneId}`,
        order: link.order,
        sceneId: link.sceneId,
        scene: scenesById.get(link.sceneId) ?? null,
      })),
    })),
    scenes,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  return NextResponse.json(await loadSchedulePayload(projectId));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        date?: string;
        duplicateFromDayId?: string;
      }
    | null;

  if (body?.duplicateFromDayId) {
    const src = await prisma.shootDay.findFirst({
      where: { id: body.duplicateFromDayId, projectId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    if (!src) {
      return NextResponse.json({ error: "Source shoot day not found" }, { status: 404 });
    }
    const dateIso = body.date ?? new Date(Date.now() + 86400000).toISOString();
    const day = await prisma.$transaction(async (tx) => {
      const created = await tx.shootDay.create({
        data: {
          projectId,
          date: new Date(dateIso),
          status: "PLANNED",
          unit: src.unit,
          callTime: src.callTime,
          wrapTime: src.wrapTime,
          locationSummary: src.locationSummary,
          scenesBeingShot: src.scenesBeingShot,
          dayNotes: src.dayNotes,
        },
      });
      if (src.scenes.length > 0) {
        await tx.shootDayScene.createMany({
          data: src.scenes.map((s) => ({
            shootDayId: created.id,
            sceneId: s.sceneId,
            order: s.order,
          })),
        });
      }
      return created;
    });
    return NextResponse.json(await loadSchedulePayload(projectId), { status: 201 });
  }

  const dateIso = body?.date ?? new Date().toISOString();
  const day = await prisma.shootDay.create({
    data: {
      projectId,
      date: new Date(dateIso),
      status: "PLANNED",
    },
  });
  return NextResponse.json({ day }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
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
          scenesBeingShot?: string | null;
          dayNotes?: string | null;
          status: string;
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
        where: { id: d.id, projectId },
        data: {
          date: new Date(d.date),
          unit: d.unit ?? null,
          callTime: d.callTime ?? null,
          wrapTime: d.wrapTime ?? null,
          status: d.status,
          locationSummary: d.locationSummary ?? null,
          scenesBeingShot: d.scenesBeingShot ?? null,
          dayNotes: d.dayNotes ?? null,
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

  return NextResponse.json(await loadSchedulePayload(projectId));
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const dayId = new URL(req.url).searchParams.get("dayId");
  if (!dayId) {
    return NextResponse.json({ error: "Missing dayId" }, { status: 400 });
  }

  const result = await prisma.shootDay.deleteMany({
    where: { id: dayId, projectId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });
  }

  return NextResponse.json(await loadSchedulePayload(projectId));
}
