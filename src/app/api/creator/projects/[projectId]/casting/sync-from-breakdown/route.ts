import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { syncCastingRolesFromBreakdown } from "@/lib/casting-sync";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const result = await syncCastingRolesFromBreakdown(projectId);
  return NextResponse.json(
    { created: result.created, skipped: result.skipped, relinked: result.relinked },
    { status: result.created > 0 ? 201 : 200 },
  );
}
