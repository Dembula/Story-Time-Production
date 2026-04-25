import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCallSheetPayload, snapshotToJsonStrings } from "@/lib/call-sheet-builder";
import { buildProductionDataEngine } from "@/lib/production-day-engine";
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  if (sheetId) {
    const sheet = await prisma.callSheet.findFirst({
      where: { id: sheetId, projectId },
      include: { shootDay: true },
    });
    if (!sheet) {
      return NextResponse.json({ error: "Call sheet not found" }, { status: 404 });
    }
    return NextResponse.json({
      callSheet: {
        ...sheet,
        parsed: {
          cast: safeParseJson(sheet.castJson),
          crew: safeParseJson(sheet.crewJson),
          locations: safeParseJson(sheet.locationsJson),
          schedule: safeParseJson(sheet.scheduleJson),
        },
        formats: {
          pdfExportReady: true,
          shareablePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${sheet.shootDayId}&sheetId=${sheet.id}&view=share`,
          mobilePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${sheet.shootDayId}&sheetId=${sheet.id}&view=mobile`,
        },
      },
    });
  }

  const callSheets = await prisma.callSheet.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { shootDay: true },
  });
  const enriched = callSheets.map((sheet) => ({
    ...sheet,
    parsed: {
      cast: safeParseJson(sheet.castJson),
      crew: safeParseJson(sheet.crewJson),
      locations: safeParseJson(sheet.locationsJson),
      schedule: safeParseJson(sheet.scheduleJson),
    },
    formats: {
      pdfExportReady: true,
      shareablePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${sheet.shootDayId}&sheetId=${sheet.id}&view=share`,
      mobilePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${sheet.shootDayId}&sheetId=${sheet.id}&view=mobile`,
    },
  }));

  return NextResponse.json({ callSheets: enriched });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        shootDayId: string;
        title?: string;
        notes?: string;
        castJson?: string;
        crewJson?: string;
        locationsJson?: string;
        scheduleJson?: string;
      }
    | null;

  if (!body?.shootDayId) {
    return NextResponse.json({ error: "Missing shootDayId" }, { status: 400 });
  }

  const unsignedContracts = await prisma.projectContract.count({
    where: {
      projectId,
      NOT: { status: { in: [...SIGNED_CONTRACT_STATUSES] } },
    },
  });

  const built = await buildCallSheetPayload(projectId, body.shootDayId);
  if (!built) {
    return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });
  }
  const snap = snapshotToJsonStrings(built);

  const versionAgg = await prisma.callSheet.aggregate({
    where: { projectId, shootDayId: body.shootDayId },
    _max: { version: true },
  });
  const nextVersion = (versionAgg._max.version ?? 0) + 1;

  const callSheet = await prisma.callSheet.create({
    data: {
      projectId,
      shootDayId: body.shootDayId,
      version: nextVersion,
      title: body.title ?? null,
      notes: body.notes ?? null,
      castJson: body.castJson ?? snap.castJson,
      crewJson: body.crewJson ?? snap.crewJson,
      locationsJson: body.locationsJson ?? snap.locationsJson,
      scheduleJson: body.scheduleJson ?? snap.scheduleJson,
    },
  });

  const engine = await buildProductionDataEngine(prisma, projectId, access.userId);
  const productionDay = engine?.productionDays.find((d) => d.id === body.shootDayId) ?? null;
  return NextResponse.json(
    {
      callSheet,
      output: productionDay?.callSheetOutput ?? null,
      formats: {
        pdfExportReady: true,
        shareablePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${body.shootDayId}&sheetId=${callSheet.id}&view=share`,
        mobilePath: `/creator/projects/${projectId}/production/call-sheet-generator?dayId=${body.shootDayId}&sheetId=${callSheet.id}&view=mobile`,
      },
      warnings:
        unsignedContracts > 0
          ? [
              `${unsignedContracts} project contract(s) are not fully signed. Cast and locations are still filtered to signed deals when applicable.`,
            ]
          : [],
    },
    { status: 201 },
  );
}

function safeParseJson(v: string | null) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
