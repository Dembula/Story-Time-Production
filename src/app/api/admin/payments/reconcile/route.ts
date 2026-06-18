import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeGatewayPayment } from "@/lib/payments/complete-gateway-payment";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { parsePayFastSettlementFromItn } from "@/lib/payments/payfast-settlement";
import { syncPayFastPaymentRecord } from "@/lib/payments/payfast-itn-processor";

const db = prisma as any;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { adminId: null as string | null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: user.id, error: null as NextResponse | null };
}

export async function POST(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as {
    paymentRecordId?: string;
    providerPaymentId?: string;
    force?: boolean;
  } | null;

  const paymentRecordId = body?.paymentRecordId?.trim();
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  if (payment.status === "SUCCEEDED") {
    return NextResponse.json({ ok: true, payment, already: true });
  }

  const replay = await syncPayFastPaymentRecord(paymentRecordId);
  if (replay.ok) {
    const updated = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
    return NextResponse.json({ ok: true, payment: updated, source: "itn_replay" });
  }

  if (!body?.force) {
    return NextResponse.json(
      {
        error: replay.error,
        hint: "Pass force:true with providerPaymentId after verifying the payment in PayFast dashboard.",
      },
      { status: replay.status === 202 ? 409 : replay.status },
    );
  }

  const providerPaymentId = body.providerPaymentId?.trim() || payment.providerPaymentId;
  if (!providerPaymentId) {
    return NextResponse.json({ error: "providerPaymentId is required for forced reconciliation." }, { status: 400 });
  }

  const webhook = await db.paymentWebhookEvent.findFirst({
    where: { provider: PAYMENT_PROVIDER, reference: paymentRecordId, eventType: "itn" },
    orderBy: { createdAt: "desc" },
  });
  const webhookFields = (webhook?.payload as { fields?: Record<string, string> } | null)?.fields;
  const settlement = webhookFields
    ? parsePayFastSettlementFromItn(webhookFields, Number(payment.amount))
    : parsePayFastSettlementFromItn({}, Number(payment.amount));

  const result = await completeGatewayPayment(paymentRecordId, {
    reference: providerPaymentId,
    provider: PAYMENT_PROVIDER,
    settlement,
  });

  if (!result.ok && result.status !== 409) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      providerPaymentId,
      providerItnStatus: "COMPLETE",
      gatewayReference: providerPaymentId,
    },
  });

  const updated = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  return NextResponse.json({ ok: true, payment: updated, source: "admin_force" });
}
