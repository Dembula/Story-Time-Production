import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { loadLatestScriptRevisionImpact } from "@/lib/breakdown/script-revision-impact";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const impact = await loadLatestScriptRevisionImpact(projectId);
  return NextResponse.json({ impact });
}
