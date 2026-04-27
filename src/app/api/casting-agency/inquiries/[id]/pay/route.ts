import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_TRANSACTION_TYPE, SIMULATED_PAYMENT_PURPOSE } from "@/lib/financial-ledger";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";
import { DEFAULT_CASTING_INQUIRY_BASE_ZAR } from "@/lib/marketplace-zar-defaults";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: inquiryId } = await params;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CONTENT_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inquiry = await prisma.castingInquiry.findUnique({
    where: { id: inquiryId, creatorId: user.id },
    include: { agency: { select: { userId: true } } },
  });
  if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  if (inquiry.paymentTransactionId) return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const baseAmount = DEFAULT_CASTING_INQUIRY_BASE_ZAR;
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;

  const paymentRecord = await prisma.paymentRecord.create({
    data: {
      userId: user.id,
      provider: "DISABLED",
      purpose: SIMULATED_PAYMENT_PURPOSE.CAST_INQUIRY,
      status: "SUCCEEDED",
      amount: totalAmount,
      currency: "ZAR",
      email: user.email,
      paidAt: new Date(),
      metadata: { type: SIMULATED_PAYMENT_PURPOSE.CAST_INQUIRY, referenceId: inquiryId } as object,
    },
  });

  const tx = await prisma.transaction.create({
    data: {
      payerId: user.id,
      payeeId: inquiry.agency.userId,
      amount: baseAmount,
      feeAmount,
      totalAmount,
      status: "COMPLETED",
      type: MARKETPLACE_TRANSACTION_TYPE.CAST_INQUIRY,
      referenceId: inquiryId,
      externalPaymentId: paymentRecord.id,
    },
  });

  await prisma.castingInquiry.update({
    where: { id: inquiryId },
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
