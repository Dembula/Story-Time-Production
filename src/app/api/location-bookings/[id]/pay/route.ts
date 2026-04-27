import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasLocationBookingModels } from "@/lib/prisma-location-booking";
import { computeLocationBookingBaseZar, MARKETPLACE_TRANSACTION_TYPE, SIMULATED_PAYMENT_PURPOSE } from "@/lib/financial-ledger";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasLocationBookingModels()) {
    return NextResponse.json(
      { error: "Location models not loaded. Run: npm run refresh, then restart the dev server." },
      { status: 503 },
    );
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CONTENT_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const booking = await prisma.locationBooking.findUnique({
    where: { id: bookingId, requesterId: user.id },
    include: { location: { select: { dailyRate: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.paymentTransactionId) return NextResponse.json({ error: "Already paid" }, { status: 400 });
  if (booking.status !== "APPROVED") {
    return NextResponse.json({ error: "Booking must be approved before payment" }, { status: 400 });
  }

  const baseAmount = computeLocationBookingBaseZar({
    dailyRate: booking.location.dailyRate,
    startDate: booking.startDate,
    endDate: booking.endDate,
  });
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = baseAmount + feeAmount;

  const paymentRecord = await prisma.paymentRecord.create({
    data: {
      userId: user.id,
      provider: "DISABLED",
      purpose: SIMULATED_PAYMENT_PURPOSE.LOCATION_BOOKING,
      status: "SUCCEEDED",
      amount: totalAmount,
      currency: "ZAR",
      email: user.email,
      paidAt: new Date(),
      metadata: { type: SIMULATED_PAYMENT_PURPOSE.LOCATION_BOOKING, referenceId: bookingId },
    },
  });

  const tx = await prisma.transaction.create({
    data: {
      payerId: user.id,
      payeeId: booking.ownerId,
      amount: baseAmount,
      feeAmount,
      totalAmount,
      status: "COMPLETED",
      type: MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING,
      referenceId: bookingId,
      externalPaymentId: paymentRecord.id,
    },
  });

  await prisma.locationBooking.update({
    where: { id: bookingId },
    data: { paymentTransactionId: tx.id },
  });

  return NextResponse.json({ transactionId: tx.id, success: true });
}
