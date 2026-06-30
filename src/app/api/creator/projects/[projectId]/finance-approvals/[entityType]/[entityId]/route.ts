import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess, financeAccessDenied } from "@/lib/financial-ops-access";
import {
  decideFinanceApprovalStep,
  listFinanceApprovalSteps,
  replaceFinanceApprovalChain,
  type FinanceEntityType,
} from "@/lib/financial-ops/finance-approval-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; entityType: string; entityId: string }> },
) {
  const { projectId, entityType, entityId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const steps = await listFinanceApprovalSteps(entityType as FinanceEntityType, entityId);
  return NextResponse.json({ steps });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string; entityType: string; entityId: string }> },
) {
  const { projectId, entityType, entityId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (financeAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));
  const type = entityType as FinanceEntityType;

  if (body.action === "decide") {
    const result = await decideFinanceApprovalStep({
      entityType: type,
      entityId,
      stepId: body.stepId,
      userId: access.userId,
      decision: body.decision,
      comment: body.comment,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const steps = await replaceFinanceApprovalChain(type, entityId, body.steps ?? []);
  return NextResponse.json({ steps });
}
