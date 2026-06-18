import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PAYFAST_PROCESS_URL, getPaymentBaseUrl } from "@/lib/payments/providers/payfast-config";
import {
  buildPayFastCardConsentFields,
  buildPayFastCheckoutFields,
} from "@/lib/payments/providers/payfast";
import { appendPaymentRecordToReturnUrl, buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { toGatewaySafeReference } from "@/lib/payments/reference";

const db = prisma as any;

function resolveCheckoutReturnUrl(
  payment: { id: string; purpose?: string | null },
  metadata: Record<string, unknown>,
): string {
  const stored = metadata.returnUrl;
  if (typeof stored === "string" && stored.trim() && !stored.includes("vercel.app")) {
    return appendPaymentRecordToReturnUrl(stored, payment.id);
  }

  let nextPath = "/payments/return";
  if (typeof stored === "string" && stored.trim()) {
    try {
      const parsed = new URL(stored);
      nextPath = parsed.searchParams.get("next") || nextPath;
    } catch {
      // ignore malformed stored return URLs
    }
  }

  return appendPaymentRecordToReturnUrl(
    buildPaymentReturnUrl(nextPath, payment.purpose ?? "payment"),
    payment.id,
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string; email?: string; name?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pr = req.nextUrl.searchParams.get("pr")?.trim();
  if (!pr) return NextResponse.json({ error: "pr is required" }, { status: 400 });

  if (pr.startsWith("consent:")) {
    const reference = pr.slice("consent:".length);
    const subscriptionId = reference.startsWith("trial-consent-")
      ? reference.slice("trial-consent-".length)
      : null;

    let payerId = userId;
    let returnUrl = appendPaymentRecordToReturnUrl(
      `${getPaymentBaseUrl()}/onboarding/account`,
      subscriptionId ?? reference,
    );
    let customerEmail = session?.user?.email;
    let customerName = session?.user?.name;

    if (subscriptionId) {
      const subscription = await db.viewerSubscription.findUnique({
        where: { id: subscriptionId },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      if (!subscription || subscription.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      payerId = subscription.userId;
      customerEmail = subscription.user?.email;
      customerName = subscription.user?.name;
    } else if (reference.startsWith("card-consent-")) {
      const parts = reference.split("-");
      const refUserId = parts.length >= 3 ? parts[2] : null;
      if (refUserId && refUserId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      returnUrl = appendPaymentRecordToReturnUrl(
        `${getPaymentBaseUrl()}/browse/settings`,
        reference,
      );
    } else {
      return NextResponse.json({ error: "Invalid consent reference" }, { status: 400 });
    }

    return NextResponse.json({
      action: PAYFAST_PROCESS_URL,
      fields: buildPayFastCardConsentFields({
        reference,
        returnUrl,
        customerEmail,
        customerName,
        payerId,
      }),
    });
  }

  const payment = await db.paymentRecord.findUnique({
    where: { id: pr },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!payment || payment.userId !== userId) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status !== "PENDING") {
    return NextResponse.json({ error: "Payment is no longer pending." }, { status: 409 });
  }

  const metadata =
    payment.metadata && typeof payment.metadata === "object"
      ? (payment.metadata as Record<string, unknown>)
      : {};

  const returnUrl = resolveCheckoutReturnUrl(payment, metadata);

  return NextResponse.json({
    action: PAYFAST_PROCESS_URL,
    fields: buildPayFastCheckoutFields({
      paymentRecordId: payment.id,
      amount: payment.amount,
      purpose: payment.purpose ?? "payment",
      reference: toGatewaySafeReference("pf", payment.id),
      returnUrl,
      customerEmail: payment.email ?? payment.user?.email,
      customerName: payment.user?.name,
      metadata: {
        ...metadata,
        referenceType: payment.relatedEntityType,
        referenceId: payment.relatedEntityId,
      },
    }),
  });
}
