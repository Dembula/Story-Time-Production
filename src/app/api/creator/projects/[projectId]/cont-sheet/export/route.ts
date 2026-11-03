import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { buildFullHtmlDocument } from "@/lib/pdf/print-html-document";
import { buildContSheetBodyHtml, CONT_SHEET_PRINT_CSS } from "@/lib/cont-sheet/html";
import { serializeContSheetDay, toExportDay } from "@/lib/cont-sheet/serialize";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;
  const shootDayId = req.nextUrl.searchParams.get("shootDayId");
  if (!shootDayId) {
    return NextResponse.json({ error: "shootDayId required" }, { status: 400 });
  }

  const day = await prisma.contSheetDay.findUnique({
    where: { projectId_shootDayId: { projectId, shootDayId } },
    include: {
      scenes: { include: { takes: true }, orderBy: { sortOrder: "asc" } },
      shootDay: { select: { id: true, date: true, unit: true } },
    },
  });
  if (!day) {
    return NextResponse.json({ error: "Cont sheet not found for this shoot day." }, { status: 404 });
  }

  const serialized = serializeContSheetDay(day);
  const bodyHtml = buildContSheetBodyHtml(toExportDay(serialized));
  const title = `Cont Sheet DPR ${day.callSheetNumber || ""} ${day.reportDate || ""}`.trim();
  const html = buildFullHtmlDocument({
    title,
    bodyHtml,
    extraCss: CONT_SHEET_PRINT_CSS,
  });

  const format = req.nextUrl.searchParams.get("format") || "html";
  if (format === "json") {
    return NextResponse.json({ html, title, day: serialized });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="cont-sheet-DPR-${day.callSheetNumber || "draft"}-${(day.reportDate || "day").replace(/\//g, "-")}.html"`,
    },
  });
}
