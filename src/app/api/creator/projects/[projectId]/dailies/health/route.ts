import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { checkDailiesHealth } from "@/lib/dailies/dailies-health";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const health = await checkDailiesHealth();
  return NextResponse.json({ projectId, ...health });
}
