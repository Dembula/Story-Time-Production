import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { buildDailiesIntelligence, ensureLegacyClipsFromBatches } from "@/lib/dailies/build-intelligence-payload";
import { buildDailyReport } from "@/lib/dailies/ai-footage-analysis";
import {
  dailiesClipsToCsv,
  dailiesClipsToExcelXml,
  dailiesReportToPdfText,
} from "@/lib/dailies/dailies-export-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const reportType = req.nextUrl.searchParams.get("report") ?? "summary";
  const shootDayId = req.nextUrl.searchParams.get("shootDayId");

  await ensureLegacyClipsFromBatches(projectId);
  const [payload, project] = await Promise.all([
    buildDailiesIntelligence(projectId),
    prisma.originalProject.findUnique({ where: { id: projectId }, select: { title: true } }),
  ]);
  const title = project?.title ?? "Production";

  let dailyReport = undefined;
  if (reportType === "daily" && shootDayId) {
    const day = payload.shootDays.find((d) => d.shootDayId === shootDayId);
    const dayClips = payload.clips.filter((c) => c.shootDayId === shootDayId);
    const dayNotes = payload.clips
      .filter((c) => c.shootDayId === shootDayId)
      .flatMap((c) => []);
    if (day) {
      dailyReport = buildDailyReport({
        shootDayDate: day.date,
        clips: dayClips,
        notes: [],
        insights: dayClips.flatMap((c) => c.aiAnalysis ?? []),
      });
    }
  }

  if (format === "csv") {
    return new NextResponse(dailiesClipsToCsv(payload), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dailies-${projectId}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    return new NextResponse(dailiesClipsToExcelXml(payload), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="dailies-${projectId}.xls"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer = dailiesReportToPdfText(payload, title, dailyReport);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dailies-${projectId}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "format must be csv, xlsx, or pdf" }, { status: 400 });
}
