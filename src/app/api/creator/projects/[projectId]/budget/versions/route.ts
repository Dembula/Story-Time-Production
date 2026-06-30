import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess, financeAccessDenied } from "@/lib/financial-ops-access";
import {
  compareBudgetVersions,
  listBudgetVersions,
  setActiveBudgetVersion,
  snapshotBudgetVersion,
} from "@/lib/budget-version-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const versionA = url.searchParams.get("versionA");
  const versionB = url.searchParams.get("versionB");

  if (versionA && versionB) {
    const diff = await compareBudgetVersions(projectId, versionA, versionB);
    return NextResponse.json({ diff });
  }

  const { budget, versions } = await listBudgetVersions(projectId);
  return NextResponse.json({ budget, versions });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (financeAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));

  if (body.action === "set_active") {
    const budget = await setActiveBudgetVersion(projectId, body.versionId);
    if (!budget) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    return NextResponse.json({ budget });
  }

  const result = await snapshotBudgetVersion({
    projectId,
    userId: access.userId,
    label: body.label,
    notes: body.notes,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ version: result.version });
}
