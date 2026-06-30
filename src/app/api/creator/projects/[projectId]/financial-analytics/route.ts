import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess } from "@/lib/financial-ops-access";
import { buildFinancialAnalyticsDashboard } from "@/lib/financial-analytics-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const dashboard = await buildFinancialAnalyticsDashboard(projectId);
  return NextResponse.json({ dashboard });
}
