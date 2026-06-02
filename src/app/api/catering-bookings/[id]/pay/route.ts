import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payMarketplaceEntity } from "@/lib/payments/marketplace-pay";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CONTENT_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await payMarketplaceEntity({
    entityType: "CateringBooking",
    entityId: bookingId,
    buyerUserId: user.id,
    buyerEmail: user.email,
    buyerName: user.name,
    returnPath: "/creator/catering",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.requiresPayment) {
    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutUrl: result.checkoutUrl,
      paymentRecordId: result.paymentRecordId,
      baseAmount: result.baseAmount,
      feeAmount: result.feeAmount,
      totalAmount: result.totalAmount,
      walletHint: result.walletHint,
    });
  }

  return NextResponse.json({
    transactionId: result.transactionId,
    success: true,
    requiresPayment: false,
    paymentMode: result.paymentMode,
    baseAmount: result.baseAmount,
    feeAmount: result.feeAmount,
    totalAmount: result.totalAmount,
  });
}
