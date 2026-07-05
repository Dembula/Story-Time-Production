import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildContractHireReceiptPdf,
  contractHireReceiptNumber,
  type ContractHireReceiptAudience,
} from "@/lib/payments/contract-hire-receipt";
import { estimatePayFastFee } from "@/lib/payments/payfast-settlement";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

async function canAccessReceipt(args: {
  userId: string;
  role: string;
  projectId: string;
  contractId: string;
  audience: ContractHireReceiptAudience;
}): Promise<boolean> {
  if (args.role === "ADMIN" && args.audience === "admin") return true;

  const contract = await prisma.projectContract.findFirst({
    where: { id: args.contractId, projectId: args.projectId },
    include: {
      project: { include: { pitches: { take: 1, select: { creatorId: true } }, members: true } },
      castingTalent: { select: { castingAgency: { select: { userId: true } } } },
      crewTeam: { select: { userId: true } },
    },
  });
  if (!contract?.paymentTransactionId) return false;

  const tx = await prisma.transaction.findUnique({
    where: { id: contract.paymentTransactionId },
    select: { payerId: true, payeeId: true },
  });
  if (!tx) return false;

  if (args.audience === "creator") {
    const creatorId = contract.project.pitches[0]?.creatorId;
    const isMember = contract.project.members.some(
      (m) => m.userId === args.userId && ["ACTIVE", "ACCEPTED"].includes(m.status),
    );
    return tx.payerId === args.userId || creatorId === args.userId || isMember;
  }

  if (args.audience === "payee") {
    return (
      tx.payeeId === args.userId ||
      contract.counterpartyUserId === args.userId ||
      contract.castingTalent?.castingAgency?.userId === args.userId ||
      contract.crewTeam?.userId === args.userId
    );
  }

  return false;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; role?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, contractId } = await params;
  const audience = (req.nextUrl.searchParams.get("audience") ?? "creator") as ContractHireReceiptAudience;
  if (!["creator", "payee", "admin"].includes(audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  const allowed = await canAccessReceipt({ userId, role, projectId, contractId, audience });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contract = await prisma.projectContract.findFirst({
    where: { id: contractId, projectId },
    include: {
      project: { select: { title: true } },
      castingTalent: { select: { name: true } },
      crewTeam: { select: { companyName: true } },
    },
  });
  if (!contract?.paymentTransactionId) {
    return NextResponse.json({ error: "Contract has not been paid yet" }, { status: 404 });
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: contract.paymentTransactionId },
    include: {
      payer: { select: { name: true, email: true } },
      payee: { select: { name: true, email: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const payeeLabel =
    contract.recipientLabel ||
    contract.castingTalent?.name ||
    contract.crewTeam?.companyName ||
    tx.payee.name ||
    tx.payee.email ||
    "Payee";
  const payerLabel = tx.payer.name || tx.payer.email || "Creator";

  const pdf = buildContractHireReceiptPdf({
    receiptNumber: contractHireReceiptNumber(tx.id),
    audience,
    projectTitle: contract.project.title,
    contractId,
    payeeLabel,
    payerLabel,
    baseAmount: tx.amount,
    platformFeeAmount: tx.feeAmount,
    gatewayFeeAmount: estimatePayFastFee(tx.totalAmount, "cc"),
    totalAmount: tx.totalAmount,
    paidAt: contract.paidAt ?? tx.createdAt,
    transactionId: tx.id,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contract-hire-receipt-${contractId.slice(-8)}.pdf"`,
    },
  });
}
