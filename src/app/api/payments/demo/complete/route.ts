import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDemoPaymentsMode } from "@/lib/payments/config";
import {
  completeDemoCardConsent,
  completeGatewayPayment,
} from "@/lib/payments/complete-gateway-payment";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export async function POST(req: NextRequest) {
  if (!isDemoPaymentsMode()) {
    return NextResponse.json({ error: "Demo payments are not enabled." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    paymentRecordId?: string;
    reference?: string;
    flow?: string;
  } | null;

  const flow = body?.flow ?? "checkout";

  if (flow === "card_consent") {
    if (!body?.reference) {
      return NextResponse.json({ error: "reference is required for card consent." }, { status: 400 });
    }
    const result = await completeDemoCardConsent({ reference: body.reference, userId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, flow: "card_consent" });
  }

  const paymentRecordId = body?.paymentRecordId;
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: { userId: true },
  });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await completeGatewayPayment(paymentRecordId, {
    reference: body?.reference,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    paymentRecordId,
    already: result.already ?? false,
  });
}
