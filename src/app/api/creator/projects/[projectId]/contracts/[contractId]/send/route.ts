import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { sendProjectContract } from "@/lib/contract-lifecycle";
import { assertApprovalsComplete } from "@/lib/legal/contract-approval-service";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as { signatureDeadline?: string | null } | null;

  const existing = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const approvalCheck = await assertApprovalsComplete(contractId);
  if (!approvalCheck.ok) {
    return NextResponse.json({ error: approvalCheck.reason ?? "Complete approvals first" }, { status: 400 });
  }

  const sendable = ["DRAFT", "READY_TO_SEND", "UNDER_REVIEW", "INTERNAL_APPROVAL", "CHANGES_REQUESTED"];
  if (!sendable.includes(existing.status)) {
    return NextResponse.json({ error: `Cannot send contract in status ${existing.status}` }, { status: 400 });
  }

  try {
    const deadline = body?.signatureDeadline ? new Date(body.signatureDeadline) : undefined;
    const updated = await sendProjectContract(contractId, userId, {
      signatureDeadline: deadline ?? existing.signatureDeadline,
    });

    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "CONTRACT_SENT",
        message: `Contract sent for signature.`,
        metadata: JSON.stringify({ contractId }),
      },
    });

    return NextResponse.json({ contract: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send contract";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
