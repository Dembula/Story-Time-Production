import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPayFastPaymentRecord } from "@/lib/payments/payfast-itn-processor";

const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { paymentRecordId?: string } | null;
  const paymentRecordId = body?.paymentRecordId?.trim() || req.nextUrl.searchParams.get("paymentRecordId")?.trim();
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: { id: true, userId: true, status: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncPayFastPaymentRecord(paymentRecordId);
  if (!result.ok && result.status === 202) {
    return NextResponse.json({ ok: false, pending: true, message: result.error }, { status: 202 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const updated = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: { id: true, status: true, paidAt: true, purpose: true },
  });

  return NextResponse.json({
    ok: true,
    payment: updated,
    already: result.already ?? false,
  });
}
