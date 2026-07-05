import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { SIGNED_CONTRACT_STATUSES } from "@/lib/contract-template-engine";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

/** Set explicit salary amount on a signed cast/crew contract before checkout. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as { hireAmount?: number };
  const hireAmount = body.hireAmount;
  if (hireAmount == null || !Number.isFinite(hireAmount) || hireAmount <= 0) {
    return NextResponse.json({ error: "hireAmount must be a positive number" }, { status: 400 });
  }

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    select: { id: true, type: true, status: true, paymentTransactionId: true },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.type !== "ACTOR" && contract.type !== "CREW") {
    return NextResponse.json({ error: "Only cast and crew contracts support salary amount" }, { status: 400 });
  }
  if (!SIGNED_CONTRACT_STATUSES.has(contract.status)) {
    return NextResponse.json({ error: "Contract must be fully signed first" }, { status: 400 });
  }
  if (contract.paymentTransactionId) {
    return NextResponse.json({ error: "Contract salary already paid" }, { status: 400 });
  }

  const rounded = Math.round(hireAmount * 100) / 100;
  const updated = await prisma.projectContract.update({
    where: { id: contractId },
    data: { hireAmount: rounded },
    select: { id: true, hireAmount: true },
  });

  return NextResponse.json(updated);
}
