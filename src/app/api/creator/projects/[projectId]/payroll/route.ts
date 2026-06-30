import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess, financeAccessDenied } from "@/lib/financial-ops-access";
import {
  approvePayrollRun,
  createPayrollRun,
  generatePayrollFromSchedule,
  listPayrollRuns,
  payPayrollRun,
} from "@/lib/payroll-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const runs = await listPayrollRuns(projectId);
  return NextResponse.json({ runs });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (financeAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));

  if (body.action === "generate_from_schedule") {
    const run = await generatePayrollFromSchedule({
      projectId,
      userId: access.userId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      label: body.label,
    });
    return NextResponse.json({ run });
  }

  const run = await createPayrollRun({
    projectId,
    userId: access.userId,
    label: body.label,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    lines: body.lines,
  });
  return NextResponse.json({ run });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (financeAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));
  const runId = body.runId as string;
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  if (body.action === "approve") {
    const result = await approvePayrollRun(projectId, runId, access.userId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ run: result.run });
  }
  if (body.action === "pay") {
    const result = await payPayrollRun(projectId, runId, access.userId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ run: result.run });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
