import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { buildBlankContSheet, buildContSheetPrefill } from "@/lib/cont-sheet/prefill";
import { serializeContSheetDay, extractPrintTakesForDailies } from "@/lib/cont-sheet/serialize";
import type { ContSheetDayPayload, ContSheetSceneInput } from "@/lib/cont-sheet/types";
import { normalizePrintStatus } from "@/lib/cont-sheet/types";

type Ctx = { params: Promise<{ projectId: string }> };

const dayInclude = {
  scenes: { include: { takes: true }, orderBy: { sortOrder: "asc" as const } },
  shootDay: { select: { id: true, date: true, unit: true } },
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const shootDayId = req.nextUrl.searchParams.get("shootDayId");
  const includePrint = req.nextUrl.searchParams.get("printTakes") === "1";

  if (shootDayId) {
    const day = await prisma.contSheetDay.findUnique({
      where: { projectId_shootDayId: { projectId, shootDayId } },
      include: dayInclude,
    });
    if (!day) {
      return NextResponse.json({ day: null, shootDayId });
    }
    const serialized = serializeContSheetDay(day);
    return NextResponse.json({
      day: serialized,
      printTakes: includePrint ? extractPrintTakesForDailies(serialized) : undefined,
    });
  }

  const [days, shootDays] = await Promise.all([
    prisma.contSheetDay.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        shootDay: { select: { id: true, date: true, unit: true, callTime: true, wrapTime: true } },
        _count: { select: { scenes: true } },
      },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, unit: true, callTime: true, wrapTime: true, status: true },
    }),
  ]);

  return NextResponse.json({ days, shootDays });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));
  const shootDayId = typeof body.shootDayId === "string" ? body.shootDayId : "";
  if (!shootDayId) {
    return NextResponse.json({ error: "shootDayId is required." }, { status: 400 });
  }

  const blank = Boolean(body.blank);
  const forcePrefill = Boolean(body.forcePrefill) || blank;

  const existing = await prisma.contSheetDay.findUnique({
    where: { projectId_shootDayId: { projectId, shootDayId } },
    include: dayInclude,
  });
  if (existing && !forcePrefill) {
    return NextResponse.json({ day: serializeContSheetDay(existing), created: false });
  }

  let draft: ContSheetDayPayload;
  try {
    draft = blank
      ? await buildBlankContSheet(projectId, shootDayId)
      : await buildContSheetPrefill(projectId, shootDayId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : blank ? "Blank sheet failed" : "Prefill failed" },
      { status: 400 },
    );
  }

  if (existing && forcePrefill) {
    await prisma.contSheetTake.deleteMany({
      where: { scene: { dayId: existing.id } },
    });
    await prisma.contSheetScene.deleteMany({ where: { dayId: existing.id } });
    const updated = await prisma.contSheetDay.update({
      where: { id: existing.id },
      data: {
        version: existing.version + 1,
        showTitle: draft.showTitle,
        productionCompany: draft.productionCompany,
        callSheetNumber: draft.callSheetNumber,
        reportDate: draft.reportDate,
        cameraUnit: draft.cameraUnit,
        crewJson: draft.crew ?? {},
        dayClockJson: draft.dayClock ?? {},
        scenesSummaryJson: draft.scenesSummary ?? {},
        totalsJson: draft.totals ?? {},
        notes: draft.notes,
        scenes: {
          create: (draft.scenes ?? []).map((s, idx) => ({
            projectSceneId: s.projectSceneId ?? null,
            episode: s.episode ?? null,
            sceneCode: s.sceneCode,
            dayNight: s.dayNight ?? null,
            intExt: s.intExt ?? null,
            location: s.location ?? null,
            weather: s.weather ?? null,
            turnoverTime: s.turnoverTime ?? null,
            estimatedTiming: s.estimatedTiming ?? null,
            actualTiming: s.actualTiming ?? null,
            completionStatus: s.completionStatus ?? "scheduled",
            sortOrder: s.sortOrder ?? idx,
            takes: {
              create: (s.takes ?? []).map((t, tIdx) => ({
                slate: t.slate ?? null,
                takeNumber: t.takeNumber ?? null,
                pickup: t.pickup ?? null,
                printStatus: normalizePrintStatus(t.printStatus) || null,
                durationSec: t.durationSec ?? null,
                description: t.description ?? null,
                notes: t.notes ?? null,
                camera: t.camera ?? null,
                sortOrder: t.sortOrder ?? tIdx,
              })),
            },
          })),
        },
      },
      include: dayInclude,
    });
    return NextResponse.json({ day: serializeContSheetDay(updated), created: false, reset: true });
  }

  const created = await prisma.contSheetDay.create({
    data: {
      projectId,
      shootDayId,
      showTitle: draft.showTitle,
      productionCompany: draft.productionCompany,
      callSheetNumber: draft.callSheetNumber,
      reportDate: draft.reportDate,
      cameraUnit: draft.cameraUnit,
      crewJson: draft.crew ?? {},
      dayClockJson: draft.dayClock ?? {},
      scenesSummaryJson: draft.scenesSummary ?? {},
      totalsJson: draft.totals ?? {},
      notes: draft.notes,
      scenes: {
        create: (draft.scenes ?? []).map((s, idx) => ({
          projectSceneId: s.projectSceneId ?? null,
          episode: s.episode ?? null,
          sceneCode: s.sceneCode,
          dayNight: s.dayNight ?? null,
          intExt: s.intExt ?? null,
          location: s.location ?? null,
          weather: s.weather ?? null,
          turnoverTime: s.turnoverTime ?? null,
          estimatedTiming: s.estimatedTiming ?? null,
          actualTiming: s.actualTiming ?? null,
          completionStatus: s.completionStatus ?? "scheduled",
          sortOrder: s.sortOrder ?? idx,
          takes: {
            create: (s.takes ?? []).map((t, tIdx) => ({
              slate: t.slate ?? null,
              takeNumber: t.takeNumber ?? null,
              pickup: t.pickup ?? null,
              printStatus: normalizePrintStatus(t.printStatus) || null,
              durationSec: t.durationSec ?? null,
              description: t.description ?? null,
              notes: t.notes ?? null,
              camera: t.camera ?? null,
              sortOrder: t.sortOrder ?? tIdx,
            })),
          },
        })),
      },
    },
    include: dayInclude,
  });

  return NextResponse.json({ day: serializeContSheetDay(created), created: true }, { status: 201 });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = (await req.json().catch(() => ({}))) as ContSheetDayPayload & { id?: string };
  const shootDayId = typeof body.shootDayId === "string" ? body.shootDayId : "";
  if (!shootDayId && !body.id) {
    return NextResponse.json({ error: "shootDayId or id is required." }, { status: 400 });
  }

  const existing = body.id
    ? await prisma.contSheetDay.findFirst({ where: { id: body.id, projectId } })
    : await prisma.contSheetDay.findUnique({
        where: { projectId_shootDayId: { projectId, shootDayId } },
      });

  if (!existing) {
    return NextResponse.json({ error: "Cont sheet day not found. Prefill first." }, { status: 404 });
  }

  const scenes = Array.isArray(body.scenes) ? (body.scenes as ContSheetSceneInput[]) : null;

  await prisma.$transaction(async (tx) => {
    await tx.contSheetDay.update({
      where: { id: existing.id },
      data: {
        showTitle: body.showTitle ?? existing.showTitle,
        productionCompany: body.productionCompany ?? existing.productionCompany,
        callSheetNumber: body.callSheetNumber ?? existing.callSheetNumber,
        reportDate: body.reportDate ?? existing.reportDate,
        cameraUnit: body.cameraUnit ?? existing.cameraUnit,
        crewJson: body.crew ?? existing.crewJson ?? {},
        dayClockJson: body.dayClock ?? existing.dayClockJson ?? {},
        scenesSummaryJson: body.scenesSummary ?? existing.scenesSummaryJson ?? {},
        totalsJson: body.totals ?? existing.totalsJson ?? {},
        notes: body.notes !== undefined ? body.notes : existing.notes,
        version: existing.version + 1,
      },
    });

    if (scenes) {
      await tx.contSheetTake.deleteMany({ where: { scene: { dayId: existing.id } } });
      await tx.contSheetScene.deleteMany({ where: { dayId: existing.id } });
      for (let idx = 0; idx < scenes.length; idx++) {
        const s = scenes[idx];
        await tx.contSheetScene.create({
          data: {
            dayId: existing.id,
            projectSceneId: s.projectSceneId ?? null,
            episode: s.episode ?? null,
            sceneCode: s.sceneCode,
            dayNight: s.dayNight ?? null,
            intExt: s.intExt ?? null,
            location: s.location ?? null,
            weather: s.weather ?? null,
            turnoverTime: s.turnoverTime ?? null,
            estimatedTiming: s.estimatedTiming ?? null,
            actualTiming: s.actualTiming ?? null,
            completionStatus: s.completionStatus ?? "scheduled",
            sortOrder: s.sortOrder ?? idx,
            takes: {
              create: (s.takes ?? []).map((t, tIdx) => ({
                slate: t.slate ?? null,
                takeNumber: t.takeNumber ?? null,
                pickup: t.pickup ?? null,
                printStatus: normalizePrintStatus(t.printStatus) || null,
                durationSec: t.durationSec ?? null,
                description: t.description ?? null,
                notes: t.notes ?? null,
                camera: t.camera ?? null,
                sortOrder: t.sortOrder ?? tIdx,
              })),
            },
          },
        });
      }
    }
  });

  const updated = await prisma.contSheetDay.findUnique({
    where: { id: existing.id },
    include: dayInclude,
  });

  return NextResponse.json({ day: updated ? serializeContSheetDay(updated) : null });
}
