import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { getLegalAnalytics } from "@/lib/legal/contract-legal-analytics-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const analytics = await getLegalAnalytics(projectId);
  return NextResponse.json({ analytics });
}
