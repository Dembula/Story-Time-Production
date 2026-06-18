import "server-only";

import { prisma } from "@/lib/prisma";
import { buildPayFastCardUpdateUrl } from "@/lib/payments/providers/payfast-config";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

const db = prisma as any;

/** PayFast subscription/adhoc token — never a Story Time–generated reference. */
export function isPayFastChargeToken(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (v.startsWith("demo-")) return false;
  if (v.startsWith("trial-consent-")) return false;
  if (v.startsWith("card-consent-")) return false;
  if (v.startsWith("pf-")) return false;
  if (v.startsWith("manual-payout-")) return false;
  return v.length >= 8;
}

export type PayFastTokenLookup = {
  token: string;
  source: "viewer_payment_method" | "viewer_subscription";
  methodId?: string;
  subscriptionId?: string;
  cardType?: string | null;
};

/** Resolve a PayFast adhoc charge token for any user (viewer or creator). */
export async function getPayFastTokenForUser(userId: string): Promise<PayFastTokenLookup | null> {
  const method = await db.viewerPaymentMethod.findFirst({
    where: {
      userId,
      reusable: true,
      OR: [
        { authorizationCode: { not: null } },
        { customerCode: { not: null } },
      ],
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      authorizationCode: true,
      customerCode: true,
      cardType: true,
    },
  });

  const methodToken = method?.authorizationCode ?? method?.customerCode;
  if (methodToken && isPayFastChargeToken(methodToken)) {
    return {
      token: methodToken,
      source: "viewer_payment_method",
      methodId: method.id,
      cardType: method.cardType,
    };
  }

  const subscription = await db.viewerSubscription.findFirst({
    where: { userId, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
    select: { id: true, externalPaymentId: true },
  });

  if (subscription?.externalPaymentId && isPayFastChargeToken(subscription.externalPaymentId)) {
    return {
      token: subscription.externalPaymentId,
      source: "viewer_subscription",
      subscriptionId: subscription.id,
    };
  }

  return null;
}

export async function upsertPayFastPaymentMethod(args: {
  userId: string;
  token: string;
  email?: string | null;
  label?: string | null;
  lastFour?: string | null;
  cardType?: string | null;
  bank?: string | null;
}) {
  if (!isPayFastChargeToken(args.token)) {
    throw new Error("Refusing to store non-PayFast payment reference as a card token.");
  }

  const lastFour =
    args.lastFour?.replace(/\D/g, "").slice(-4) ||
    "····";
  const label =
    args.label?.trim() ||
    (args.cardType ? `${args.cardType} ••••${lastFour}` : `PayFast card ••••${lastFour}`);

  await db.viewerPaymentMethod.updateMany({
    where: { userId: args.userId },
    data: { isDefault: false },
  });

  const existing = await db.viewerPaymentMethod.findFirst({
    where: { userId: args.userId, authorizationCode: args.token },
    select: { id: true },
  });

  if (existing) {
    return db.viewerPaymentMethod.update({
      where: { id: existing.id },
      data: {
        label,
        lastFour,
        cardType: args.cardType ?? undefined,
        bank: args.bank ?? undefined,
        email: args.email ?? undefined,
        reusable: true,
        isDefault: true,
        provider: "PAYFAST",
      },
    });
  }

  return db.viewerPaymentMethod.create({
    data: {
      userId: args.userId,
      provider: "PAYFAST",
      email: args.email ?? undefined,
      label,
      lastFour,
      authorizationCode: args.token,
      cardType: args.cardType ?? undefined,
      bank: args.bank ?? undefined,
      reusable: true,
      isDefault: true,
    },
  });
}

/** Start PayFast tokenization (R0 subscription_type=2) — no card data touches Story Time. */
export async function createPayFastCardConsentForUser(args: {
  userId: string;
  email?: string | null;
  name?: string | null;
  returnUrl: string;
  referencePrefix?: string;
}) {
  const { getPaymentGateway } = await import("@/lib/payments/gateway");
  const reference = `${args.referencePrefix ?? "card-consent"}-${args.userId}-${Date.now()}`;
  const gateway = getPaymentGateway();
  const consent = await gateway.createCardConsentSession({
    reference,
    returnUrl: args.returnUrl,
    customer: { email: args.email, name: args.name, payerId: args.userId },
  });
  return { checkoutUrl: consent.checkoutUrl, reference };
}

/** Redirect URL for PayFast's hosted card update flow (`/eng/recurring/update/{token}`). */
export async function getPayFastCardUpdateUrlForUser(args: {
  userId: string;
  paymentMethodId?: string | null;
  returnPath?: string;
}): Promise<{ updateUrl: string; tokenSource: PayFastTokenLookup["source"] | "payment_method" }> {
  let token: string | null = null;
  let tokenSource: PayFastTokenLookup["source"] | "payment_method" = "viewer_payment_method";

  const methodId = args.paymentMethodId?.trim();
  if (methodId) {
    const method = await db.viewerPaymentMethod.findFirst({
      where: { id: methodId, userId: args.userId },
      select: { authorizationCode: true, customerCode: true },
    });
    token = method?.authorizationCode ?? method?.customerCode ?? null;
    tokenSource = "payment_method";
  } else {
    const lookup = await getPayFastTokenForUser(args.userId);
    token = lookup?.token ?? null;
    if (lookup) tokenSource = lookup.source;
  }

  if (!token || !isPayFastChargeToken(token)) {
    throw new Error("No PayFast card on file to update. Add a card via PayFast first.");
  }

  const returnPath = args.returnPath?.trim() || "/browse/settings";
  const returnUrl = buildPaymentReturnUrl(returnPath, "payfast_card_update");
  return {
    updateUrl: buildPayFastCardUpdateUrl(token, returnUrl),
    tokenSource,
  };
}
