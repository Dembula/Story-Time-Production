import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildProductionDataEngine,
  composeShootDayNotes,
  parseShootDayNotes,
} from "@/lib/production-day-engine";
import { SIGNED_CONTRACT_STATUSES } from "@/lib/contract-template-engine";

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
  breakdownMakeups: {
    select: { id: true, notes: true, character: true },
    orderBy: { notes: "asc" as const },
  },
} as const;

async function buildContractGate(projectId: string) {
  const contracts = await prisma.projectContract.findMany({
    where: { projectId },
    select: {
      id: true,
      type: true,
      status: true,
      subject: true,
      castingTalent: { select: { name: true } },
      crewTeam: { select: { companyName: true } },
      locationListing: { select: { name: true } },
      vendorName: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const unsigned = contracts.filter((c) => !SIGNED_CONTRACT_STATUSES.has(c.status));
  return {
    totalContracts: contracts.length,
    signedContracts: contracts.length - unsigned.length,
    unsignedContracts: unsigned.length,
    blocking: unsigned.length > 0,
    unsignedDetails: unsigned.slice(0, 20).map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      subject: c.subject,
      party:
        c.castingTalent?.name ??
        c.crewTeam?.companyName ??
        c.locationListing?.name ??
        c.vendorName ??
        null,
    })),
  };
}

async function loadSchedulePayload(projectId: string, userId: string | null) {
  const productionData = await buildProductionDataEngine(prisma, projectId, userId);
  if (!productionData) {
    return null;
  }

  const [shootDays, scenes, contractGate] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      include: {
        scenes: { orderBy: { order: "asc" } },
      },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      include: sceneScheduleInclude,
    }),
    buildContractGate(projectId),
  ]);

  scenes.sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
  );
  const scenesById = new Map(scenes.map((s) => [s.id, s]));
  const productionDayById = new Map(productionData.productionDays.map((day) => [day.id, day]));

  return {
    script: productionData.script,
    shootDays: shootDays.map((d, idx) => {
      const parsed = parseShootDayNotes(d.dayNotes);
      return {
        id: d.id,
        shootDayNumber: idx + 1,
        date: d.date.toISOString(),
        unit: d.unit,
        callTime: d.callTime,
        wrapTime: d.wrapTime,
        status: d.status,
        locationSummary: d.locationSummary,
        scenesBeingShot: d.scenesBeingShot,
        dayNotes: parsed.plainNotes,
        weather: parsed.structured.weather ?? null,
        transportDetails: parsed.structured.transportDetails ?? null,
        pickupDropoffInfo: parsed.structured.pickupDropoffInfo ?? null,
        accommodation: parsed.structured.accommodation ?? null,
        cateringNotes: parsed.structured.cateringNotes ?? null,
        callSheetNotes: parsed.structured.callSheetNotes ?? null,
        scenes: d.scenes.map((link) => ({
          id: `${d.id}-${link.sceneId}`,
          order: link.order,
          sceneId: link.sceneId,
          scene: scenesById.get(link.sceneId) ?? null,
        })),
      };
    }),
    scenes,
    productionDays: productionData.productionDays,
    conflicts: productionData.conflicts,
    contractGate,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const payload = await loadSchedulePayload(projectId, access.userId);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload);
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
    const payload = await loadSchedulePayload(projectId, access.userId);
    if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(payload, { status: 201 });
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
          weather?: string | null;
          transportDetails?: string | null;
          pickupDropoffInfo?: string | null;
          accommodation?: string | null;
          cateringNotes?: string | null;
          callSheetNotes?: string | null;
          status: string;
          scenes: { sceneId: string; order: number }[];
        }[];
      }
    | null;

  if (!body?.days) {
    return NextResponse.json({ error: "Missing days" }, { status: 400 });
  }

  const contractGate = await buildContractGate(projectId);
  if (contractGate.blocking) {
    return NextResponse.json(
      {
        error:
          "Schedule commit blocked. Some linked resources are still unconfirmed because their contracts are not signed.",
        contractGate,
      },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const d of body.days) {
      const current = await tx.shootDay.findFirst({
        where: { id: d.id, projectId },
        select: { dayNotes: true },
      });
      const existing = parseShootDayNotes(current?.dayNotes);
      const combinedDayNotes = composeShootDayNotes(
        d.dayNotes ?? existing.plainNotes,
        {
          weather: d.weather ?? existing.structured.weather ?? null,
          transportDetails: d.transportDetails ?? existing.structured.transportDetails ?? null,
          pickupDropoffInfo: d.pickupDropoffInfo ?? existing.structured.pickupDropoffInfo ?? null,
          accommodation: d.accommodation ?? existing.structured.accommodation ?? null,
          cateringNotes: d.cateringNotes ?? existing.structured.cateringNotes ?? null,
          callSheetNotes: d.callSheetNotes ?? existing.structured.callSheetNotes ?? null,
        },
      );

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
          dayNotes: combinedDayNotes,
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
  }, { timeout: 60000, maxWait: 10000 });

  const payload = await loadSchedulePayload(projectId, access.userId);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload);
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

  const payload = await loadSchedulePayload(projectId, access.userId);
  if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(payload);
}
