import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { calculatePlatformTransactionFee, splitViewerRevenue } from "@/lib/payments/fees";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { appendPaymentRecordToReturnUrl } from "@/lib/payments/return-url";
const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        purpose?: string;
        amount?: number;
        currency?: string;
        referenceType?: string;
        referenceId?: string;
        returnUrl?: string;
        metadata?: Record<string, unknown>;
      }
    | null;

  if (!body?.purpose || !body.amount || !body.referenceType || !body.referenceId) {
    return NextResponse.json({ error: "purpose, amount, referenceType and referenceId are required." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const platformTxFee = calculatePlatformTransactionFee(amount);
  const viewerSplit = splitViewerRevenue(amount);
  const record = await db.paymentRecord.create({
    data: {
      userId: user.id,
      provider: PAYMENT_PROVIDER,
      purpose: body.purpose,
      status: "PENDING",
      amount,
      currency: body.currency || "ZAR",
      email: user.email ?? undefined,
      relatedEntityType: body.referenceType,
      relatedEntityId: body.referenceId,
      metadata: {
        ...(body.metadata ?? {}),
        platformTxFee,
        viewerCreatorSplitAmount: viewerSplit.creator,
        viewerPlatformSplitAmount: viewerSplit.platform,
      },
    },
  });

  const gateway = getPaymentGateway();
  let checkout: Awaited<ReturnType<typeof gateway.createCheckoutSession>>;
  try {
    checkout = await gateway.createCheckoutSession({
      amount,
      currency: body.currency || "ZAR",
      reference: toGatewaySafeReference("pf", record.id),
      returnUrl: appendPaymentRecordToReturnUrl(body.returnUrl, record.id),
      customer: { email: user.email, name: user.name },
      metadata: {
        paymentRecordId: record.id,
        purpose: body.purpose,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
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
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      externalRef: checkout.externalRef,
      metadata: {
        paymentRecordId: record.id,
        checkoutUrl: checkout.checkoutUrl,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    paymentRecordId: record.id,
    provider: checkout.provider,
    checkoutUrl: checkout.checkoutUrl,
    externalRef: checkout.externalRef,
  });
}
