import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_TRANSACTION_TYPE, SIMULATED_PAYMENT_PURPOSE } from "@/lib/financial-ledger";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";
import { DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR } from "@/lib/marketplace-zar-defaults";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: requestId } = await params;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CONTENT_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reqRow = await prisma.crewTeamRequest.findUnique({
    where: { id: requestId, creatorId: user.id },
    include: { crewTeam: { select: { userId: true } } },
  });
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (reqRow.paymentTransactionId) return NextResponse.json({ error: "Already paid" }, { status: 400 });
  if (reqRow.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Crew request must be accepted before payment" }, { status: 400 });
  }

  const baseAmount = DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR;
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;

  const paymentRecord = await prisma.paymentRecord.create({
    data: {
      userId: user.id,
      provider: "DISABLED",
      purpose: SIMULATED_PAYMENT_PURPOSE.CREW_REQUEST,
      status: "SUCCEEDED",
      amount: totalAmount,
      currency: "ZAR",
      email: user.email,
      paidAt: new Date(),
      metadata: { type: SIMULATED_PAYMENT_PURPOSE.CREW_REQUEST, referenceId: requestId } as object,
    },
  });

  const tx = await prisma.transaction.create({
    data: {
      payerId: user.id,
      payeeId: reqRow.crewTeam.userId,
      amount: baseAmount,
      feeAmount,
      totalAmount,
      status: "COMPLETED",
      type: MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST,
      referenceId: requestId,
      externalPaymentId: paymentRecord.id,
    },
  });

  await prisma.crewTeamRequest.update({
    where: { id: requestId },
    data: { paymentTransactionId: tx.id },
  });

  return NextResponse.json({
    transactionId: tx.id,
    success: true,
    baseAmount,
    feeAmount,
    totalAmount,
  });
}
