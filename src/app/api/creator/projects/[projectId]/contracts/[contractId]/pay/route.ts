import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { resolveContractHireSettlement } from "@/lib/payments/contract-hire-settlement";
import { payContractHire } from "@/lib/payments/contract-hire-pay";

interface Params {
  params: Promise<{ projectId: string; contractId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const resolved = await resolveContractHireSettlement(contractId, projectId, access.userId!);
  const contract = await prisma.projectContract.findUnique({
    where: { id: contractId },
    select: { paymentTransactionId: true, paidAt: true, hireAmount: true },
  });

  if (!resolved.ok) {
    if (resolved.error === "Contract salary already paid" && contract?.paymentTransactionId) {
      return NextResponse.json({
        quote: null,
        paid: true,
        paymentTransactionId: contract.paymentTransactionId,
        paidAt: contract.paidAt?.toISOString() ?? null,
        hireAmount: contract.hireAmount,
      });
    }
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({
    quote: {
      baseAmount: resolved.quote.baseAmount,
      platformFeeAmount: resolved.quote.platformFeeAmount,
      gatewayFeeEstimate: resolved.quote.gatewayFeeEstimate,
      totalAmount: resolved.quote.totalAmount,
      payeeLabel: resolved.quote.payeeLabel,
      contractType: resolved.quote.contractType,
    },
    paid: Boolean(contract?.paymentTransactionId),
    paymentTransactionId: contract?.paymentTransactionId ?? null,
    paidAt: contract?.paidAt?.toISOString() ?? null,
    hireAmount: contract?.hireAmount ?? resolved.quote.baseAmount,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId, contractId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => ({}))) as { returnPath?: string };
  const returnPath =
    body.returnPath?.trim() ||
    `/creator/projects/${projectId}/pre-production/legal`;

  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; name?: string | null } | undefined;

  const result = await payContractHire({
    contractId,
    projectId,
    payerUserId: access.userId!,
    payerEmail: user?.email,
    payerName: user?.name,
    returnPath,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.requiresPayment) {
    return NextResponse.json({
      success: true,
      requiresPayment: true,
      awaitingGatewayConfirmation: result.awaitingGatewayConfirmation ?? false,
      checkoutUrl: result.checkoutUrl,
      paymentRecordId: result.paymentRecordId,
      baseAmount: result.baseAmount,
      platformFeeAmount: result.platformFeeAmount,
      feeAmount: result.feeAmount,
      gatewayFeeEstimate: result.gatewayFeeEstimate,
      totalAmount: result.totalAmount,
      payeeLabel: result.payeeLabel,
      walletHint: result.walletHint,
    });
  }

  return NextResponse.json({
    success: true,
    requiresPayment: false,
    transactionId: result.transactionId,
    paymentMode: result.paymentMode,
    baseAmount: result.baseAmount,
    platformFeeAmount: result.platformFeeAmount,
    feeAmount: result.feeAmount,
    gatewayFeeEstimate: result.gatewayFeeEstimate,
    totalAmount: result.totalAmount,
    payeeLabel: result.payeeLabel,
    message: "Contract salary paid. Receipt available for download.",
  });
}
