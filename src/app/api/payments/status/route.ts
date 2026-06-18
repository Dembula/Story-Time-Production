import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGatewayMode } from "@/lib/payments/config";
import { syncPayFastPaymentRecord } from "@/lib/payments/payfast-itn-processor";

const db = prisma as any;

export async function GET(req: NextRequest) {
  const paymentRecordId = req.nextUrl.searchParams.get("paymentRecordId");
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  let payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      updatedAt: true,
      purpose: true,
      relatedEntityType: true,
      relatedEntityId: true,
      settlementAmount: true,
      providerFeeAmount: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  }

  let synced = false;
  if (payment.status === "PENDING" && getPaymentGatewayMode() === "payfast") {
    const sync = await syncPayFastPaymentRecord(paymentRecordId);
    synced = sync.ok;
    if (sync.ok) {
      payment = await db.paymentRecord.findUnique({
        where: { id: paymentRecordId },
        select: {
          id: true,
          status: true,
          paidAt: true,
          updatedAt: true,
          purpose: true,
          relatedEntityType: true,
          relatedEntityId: true,
          settlementAmount: true,
          providerFeeAmount: true,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    payment,
    synced,
    gatewayMode: getPaymentGatewayMode(),
  });
}
