import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCallSheetPayload } from "@/lib/call-sheet-builder";
import { buildProductionDataEngine } from "@/lib/production-day-engine";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const shootDayId = req.nextUrl.searchParams.get("shootDayId");
  if (!shootDayId) {
    return NextResponse.json({ error: "Missing shootDayId" }, { status: 400 });
  }

  const payload = await buildCallSheetPayload(projectId, shootDayId, access.userId);
  if (!payload) {
    return NextResponse.json({ error: "Shoot day not found" }, { status: 404 });
  }

  const engine = await buildProductionDataEngine(prisma, projectId, access.userId);
  const day = engine?.productionDays.find((d) => d.id === shootDayId) ?? null;
  const dayConflicts = (engine?.conflicts ?? []).filter((c) => c.dayIds.includes(shootDayId));

  return NextResponse.json({
    preview: payload,
    productionDay: day,
    conflicts: dayConflicts,
  });
}
