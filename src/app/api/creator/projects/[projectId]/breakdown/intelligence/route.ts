import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { buildBreakdownIntelligence } from "@/lib/breakdown/build-intelligence-payload";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const payload = await buildBreakdownIntelligence(projectId);
  return NextResponse.json(payload);
}
