import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { buildDailiesIntelligence, ensureLegacyClipsFromBatches } from "@/lib/dailies/build-intelligence-payload";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  await ensureLegacyClipsFromBatches(projectId);
  const payload = await buildDailiesIntelligence(projectId);
  return NextResponse.json({ intelligence: payload });
}
