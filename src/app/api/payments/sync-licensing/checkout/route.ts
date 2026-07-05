import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { resolveSyncLicensingSettlement } from "@/lib/payments/sync-licensing-settlement";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { appendPaymentRecordToReturnUrl } from "@/lib/payments/return-url";

const db = prisma as typeof prisma & {
  paymentRecord: {
    create: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<unknown>;
  };
  gatewayReference: { create: (args: unknown) => Promise<unknown> };
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { syncRequestId?: string; returnUrl?: string } | null;
  if (!body?.syncRequestId) {
    return NextResponse.json({ error: "syncRequestId is required" }, { status: 400 });
  }

  const resolved = await resolveSyncLicensingSettlement(body.syncRequestId, user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const quote = resolved.quote;

  const record = await db.paymentRecord.create({
    data: {
      userId: user.id,
      provider: PAYMENT_PROVIDER,
      purpose: quote.purpose,
      status: "PENDING",
      amount: quote.totalAmount,
      currency: "ZAR",
      email: user.email ?? undefined,
      relatedEntityType: quote.entityType,
      relatedEntityId: quote.entityId,
      metadata: {
        syncLicensing: true,
        baseAmount: quote.baseAmount,
        feeAmount: quote.feeAmount,
        musicTrackId: quote.musicTrackId,
      },
    },
  });

  const gateway = getPaymentGateway();
  let checkout: Awaited<ReturnType<typeof gateway.createCheckoutSession>>;
  try {
    checkout = await gateway.createCheckoutSession({
      amount: quote.totalAmount,
      currency: "ZAR",
      reference: toGatewaySafeReference("pf", record.id),
      returnUrl: appendPaymentRecordToReturnUrl(body.returnUrl, record.id),
      customer: { email: user.email, name: user.name },
      metadata: {
        paymentRecordId: record.id,
        purpose: quote.purpose,
        referenceType: quote.entityType,
        referenceId: quote.entityId,
      },
    });
  } catch (error) {
    await db.paymentRecord.update({
      where: { id: record.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize checkout." },
      { status: 502 },
    );
  }

  await db.gatewayReference.create({
    data: {
      provider: checkout.provider,
      referenceType: quote.entityType,
      referenceId: quote.entityId,
      externalRef: checkout.externalRef,
      metadata: { paymentRecordId: record.id },
    },
  });

  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    paymentRecordId: record.id,
    amount: quote.totalAmount,
    baseAmount: quote.baseAmount,
    feeAmount: quote.feeAmount,
  });
}
