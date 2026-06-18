import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { completeGatewayPayment } from "@/lib/payments/complete-gateway-payment";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { PAYFAST_VALIDATE_URL } from "@/lib/payments/providers/payfast-config";
import { parsePayFastFormBody } from "@/lib/payments/providers/payfast-signature";
import { isPayFastChargeToken, upsertPayFastPaymentMethod } from "@/lib/payments/payfast-saved-card";
import { resolvePaymentRecordIdFromPayFastItn } from "@/lib/payments/resolve-itn-payment-record";

const db = prisma as any;

async function validateItnWithPayFast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const gateway = getPaymentGateway();
  if (!gateway.verifyWebhookSignature(rawBody, (name) => req.headers.get(name))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const data = parsePayFastFormBody(rawBody);
  const paymentStatus = (data.payment_status ?? "").toUpperCase();
  const pfPaymentId = data.pf_payment_id ?? data.m_payment_id ?? "";
  const flow = data.custom_str2 ?? "";

  if (flow === "card_consent" && data.token) {
    const reference = data.custom_str3 ?? data.m_payment_id ?? "";
    const payerUserId = data.custom_str1?.trim() || null;

    if (reference.startsWith("trial-consent-")) {
      const subscriptionId = reference.slice("trial-consent-".length);
      if (subscriptionId && isPayFastChargeToken(data.token)) {
        await db.viewerSubscription.update({
          where: { id: subscriptionId },
          data: {
            externalPaymentId: data.token,
            lastPaymentStatus: "SUCCEEDED",
            lastPaymentError: null,
          },
        }).catch(() => {});

        const sub = await db.viewerSubscription.findUnique({
          where: { id: subscriptionId },
          select: { userId: true, user: { select: { email: true } } },
        });
        if (sub?.userId) {
          await upsertPayFastPaymentMethod({
            userId: sub.userId,
            token: data.token,
            email: sub.user?.email ?? data.email_address,
            label: data.payment_method ? String(data.payment_method) : undefined,
            lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
            cardType: data.payment_method ? String(data.payment_method) : undefined,
          }).catch((err: unknown) => console.error("payfast method upsert failed", err));
        }
      }
    } else if (payerUserId && isPayFastChargeToken(data.token)) {
      await upsertPayFastPaymentMethod({
        userId: payerUserId,
        token: data.token,
        email: data.email_address,
        label: data.payment_method ? String(data.payment_method) : undefined,
        lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
        cardType: data.payment_method ? String(data.payment_method) : undefined,
      }).catch((err: unknown) => console.error("payfast method upsert failed", err));

      await db.viewerSubscription.updateMany({
        where: { userId: payerUserId, viewerModel: "SUBSCRIPTION" },
        data: { externalPaymentId: data.token, lastPaymentStatus: "SUCCEEDED", lastPaymentError: null },
      }).catch(() => {});
    }

    return new NextResponse("OK", { status: 200 });
  }

  const paymentRecordId = await resolvePaymentRecordIdFromPayFastItn(data);
  if (!paymentRecordId) {
    return new NextResponse("Missing payment reference", { status: 400 });
  }

  if (paymentStatus !== "COMPLETE") {
    if (paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
      await db.paymentRecord.update({
        where: { id: paymentRecordId },
        data: { status: paymentStatus === "CANCELLED" ? "CANCELLED" : "FAILED" },
      }).catch(() => {});
    }
    return new NextResponse("OK", { status: 200 });
  }

  const valid = await validateItnWithPayFast(rawBody);
  if (!valid) {
    return new NextResponse("ITN validation failed", { status: 400 });
  }

  const payment = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!payment) return new NextResponse("Payment not found", { status: 404 });

  const paidAmount = Number(data.amount_gross ?? data.amount ?? 0);
  if (Number.isFinite(paidAmount) && Math.abs(paidAmount - payment.amount) > 0.02) {
    return new NextResponse("Amount mismatch", { status: 400 });
  }

  const result = await completeGatewayPayment(paymentRecordId, {
    reference: pfPaymentId,
    provider: PAYMENT_PROVIDER,
  });

  if (data.token && payment.userId && isPayFastChargeToken(data.token)) {
    await upsertPayFastPaymentMethod({
      userId: payment.userId,
      token: data.token,
      email: data.email_address ?? payment.email,
      label: data.payment_method ? String(data.payment_method) : undefined,
      lastFour: data.cc_mask ? String(data.cc_mask).slice(-4) : undefined,
      cardType: data.payment_method ? String(data.payment_method) : undefined,
    }).catch((err: unknown) => console.error("payfast checkout token save failed", err));
  }

  if (!result.ok && result.status !== 409) {
    return new NextResponse(result.error, { status: result.status });
  }

  return new NextResponse("OK", { status: 200 });
}
