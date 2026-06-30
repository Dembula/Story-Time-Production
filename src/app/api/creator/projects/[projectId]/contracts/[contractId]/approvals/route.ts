import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  decideApprovalStep,
  defaultContractApprovalChain,
  listApprovalSteps,
  replaceApprovalChain,
} from "@/lib/legal/contract-approval-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contract = await prisma.projectContract.findFirst({ where: { id: contractId, projectId } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const steps = await listApprovalSteps(contractId);
  const members = await prisma.originalMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ steps, approvalRequired: contract.approvalRequired, members });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string; contractId: string }> }) {
  const { projectId, contractId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));
  const contract = await prisma.projectContract.findFirst({ where: { id: contractId, projectId } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "decide") {
    const result = await decideApprovalStep({
      contractId,
      stepId: body.stepId,
      userId: access.userId,
      decision: body.decision,
      comment: body.comment,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "default_chain") {
    const steps = await defaultContractApprovalChain(projectId, contractId);
    return NextResponse.json({ steps });
  }

  const steps = await replaceApprovalChain(contractId, body.steps ?? []);
  return NextResponse.json({ steps });
}
