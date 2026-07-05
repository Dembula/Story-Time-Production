import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { buildCallSheetPayload } from "@/lib/call-sheet-builder";
import { buildCallSheetPdf } from "@/lib/call-sheet-pdf";
import { pdfAttachmentResponse } from "@/lib/pdf/document-pdf";

function safeParseJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const shootDayId = req.nextUrl.searchParams.get("shootDayId")?.trim() ?? "";
  const sheetId = req.nextUrl.searchParams.get("sheetId")?.trim() ?? "";
  const extraNotes = req.nextUrl.searchParams.get("notes")?.trim() || null;

  try {
    if (sheetId) {
      const sheet = await prisma.callSheet.findFirst({
        where: { id: sheetId, projectId },
        include: { shootDay: true },
      });
      if (!sheet) return NextResponse.json({ error: "Call sheet not found" }, { status: 404 });

      const schedule = safeParseJson(sheet.scheduleJson) as {
        meta?: Record<string, unknown>;
        rows?: unknown[];
        tasks?: unknown[];
        safety?: unknown[];
        header?: unknown;
        timing?: unknown;
      } | null;
      const meta = (schedule?.meta ?? {}) as Record<string, unknown>;
      const shootDate = sheet.shootDay?.date;
      const dateIso =
        shootDate instanceof Date
          ? shootDate.toISOString()
          : String(shootDate ?? meta.date ?? "");
      const header = (schedule?.header ?? {
        productionTitle: sheet.title ?? "Production",
        productionCompany: null,
        shootDayNumber: 1,
        totalShootDays: 1,
        dateIso,
        primaryLocationSummary: (meta.locationSummary as string) ?? null,
      }) as Parameters<typeof buildCallSheetPdf>[0]["header"];
      const timing = (schedule?.timing ?? {
        generalCall: (meta.callTime as string) ?? null,
        estimatedWrap: (meta.wrapTime as string) ?? null,
        mealBreakNotes: null,
      }) as Parameters<typeof buildCallSheetPdf>[0]["timing"];

      const pdf = buildCallSheetPdf({
        header,
        timing,
        weather: (meta.weather as string) ?? null,
        logistics: (meta.logistics as Record<string, string | null | undefined>) ?? null,
        equipment: (meta.equipment as { equipmentName: string; category: string; quantity: number }[]) ?? [],
        schedule: Array.isArray(schedule?.rows) ? (schedule!.rows as never[]) : [],
        cast: (safeParseJson(sheet.castJson) as never[]) ?? [],
        crew: (safeParseJson(sheet.crewJson) as never[]) ?? [],
        locations: (safeParseJson(sheet.locationsJson) as never[]) ?? [],
        tasks: Array.isArray(schedule?.tasks) ? (schedule!.tasks as never[]) : [],
        safety: Array.isArray(schedule?.safety) ? (schedule!.safety as never[]) : [],
        dayNotes: (meta.dayNotes as string) ?? null,
        extraNotes: sheet.notes ?? extraNotes,
        versionLabel: `Version ${sheet.version}${sheet.title ? ` · ${sheet.title}` : ""}`,
      });

      const filename = `call-sheet-v${sheet.version}-${header.productionTitle}.pdf`;
      return pdfAttachmentResponse(pdf, filename);
    }

    if (!shootDayId) {
      return NextResponse.json({ error: "shootDayId or sheetId is required" }, { status: 400 });
    }

    const payload = await buildCallSheetPayload(projectId, shootDayId, access.userId);
    if (!payload) {
      return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });
    }

    const pdf = buildCallSheetPdf({
      header: payload.header,
      timing: payload.timing,
      weather: payload.meta.weather,
      logistics: payload.meta.logistics,
      equipment: payload.meta.equipment,
      schedule: payload.schedule,
      cast: payload.cast,
      crew: payload.crew.map((c) => ({
        role: c.role,
        name: c.name,
        department: c.department,
        callTime: c.callTime,
      })),
      locations: payload.locations,
      tasks: payload.tasks,
      safety: payload.safety,
      dayNotes: payload.meta.dayNotes,
      extraNotes,
    });

    const datePart = payload.header.dateIso.slice(0, 10);
    const filename = `call-sheet-${payload.header.productionTitle}-${datePart}.pdf`;
    return pdfAttachmentResponse(pdf, filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build call sheet PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
