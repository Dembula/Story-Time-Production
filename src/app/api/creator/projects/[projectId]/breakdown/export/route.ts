import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { buildBreakdownIntelligence } from "@/lib/breakdown/build-intelligence-payload";
import {
  breakdownCatalogToCsv,
  breakdownCatalogToExcelXml,
  breakdownReportToPdfText,
  breakdownSceneSheetsToPdfText,
} from "@/lib/breakdown/breakdown-export-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  const report = req.nextUrl.searchParams.get("report") ?? "full";

  const [payload, project] = await Promise.all([
    buildBreakdownIntelligence(projectId),
    prisma.originalProject.findUnique({ where: { id: projectId }, select: { title: true } }),
  ]);
  const title = project?.title ?? "Production";

  if (format === "csv") {
    const body = breakdownCatalogToCsv(payload);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="breakdown-${projectId}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const body = breakdownCatalogToExcelXml(payload);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="breakdown-${projectId}.xls"`,
      },
    });
  }

  if (format === "pdf") {
    const buffer =
      report === "scenes"
        ? breakdownSceneSheetsToPdfText(payload, title)
        : breakdownReportToPdfText(payload, title);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="breakdown-${projectId}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "format must be csv, xlsx, or pdf" }, { status: 400 });
}
