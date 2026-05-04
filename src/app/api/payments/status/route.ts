import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function GET(req: NextRequest) {
  const paymentRecordId = req.nextUrl.searchParams.get("paymentRecordId");
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      updatedAt: true,
      purpose: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    payment,
  });
}
