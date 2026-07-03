import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { getPaymentGateway } from "@/lib/payments/gateway";
import {
  resolveMarketplaceSettlement,
  type MarketplaceEntityType,
} from "@/lib/payments/marketplace-settlement";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { appendPaymentRecordToReturnUrl } from "@/lib/payments/return-url";

const db = prisma as any;

const MARKETPLACE_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "EquipmentRequest",
  "LocationBooking",
  "CateringBooking",
  "CrewTeamRequest",
  "CastingInquiry",
]);

/**
 * Generic checkout for marketplace entities. The amount is ALWAYS priced
 * server-side from the referenced entity — client-supplied amounts are never
 * trusted. Purpose-specific flows (viewer subscription, casting fees, etc.)
 * have their own server-priced endpoints.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        referenceType?: string;
        referenceId?: string;
        returnUrl?: string;
        metadata?: Record<string, unknown>;
      }
    | null;

  if (!body?.referenceType || !body.referenceId) {
    return NextResponse.json(
      { error: "referenceType and referenceId are required." },
      { status: 400 },
    );
  }

  if (!MARKETPLACE_ENTITY_TYPES.has(body.referenceType)) {
    return NextResponse.json(
      { error: `Unsupported referenceType "${body.referenceType}". Use the purpose-specific payment endpoint.` },
      { status: 400 },
    );
  }

  const resolved = await resolveMarketplaceSettlement(
    body.referenceType as MarketplaceEntityType,
    body.referenceId,
    user.id,
  );
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
        marketplace: true,
        baseAmount: quote.baseAmount,
        feeAmount: quote.feeAmount,
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
      metadata: {
        paymentRecordId: record.id,
        checkoutUrl: checkout.checkoutUrl,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    paymentRecordId: record.id,
    amount: quote.totalAmount,
    provider: checkout.provider,
    checkoutUrl: checkout.checkoutUrl,
    externalRef: checkout.externalRef,
  });
}
