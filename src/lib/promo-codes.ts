import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export type PromoContext = "VIEWER_SUBSCRIPTION" | "CREATOR_LICENSE";

export async function resolvePromoCode(codeRaw: string, target: "VIEWER_SUBSCRIPTION" | "CREATOR_LICENSE" | "ANY") {
  const code = codeRaw.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { error: "Promo code is required." as const };

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.active) return { error: "Promo code is invalid or inactive." as const };

  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { error: "Promo code is not active yet." as const };
  if (promo.expiresAt && promo.expiresAt < now) return { error: "Promo code has expired." as const };
  if (promo.maxRedemptions != null && promo.redemptionsCount >= promo.maxRedemptions) {
    return { error: "Promo code redemption limit reached." as const };
  }
  if (promo.target !== "ANY" && promo.target !== target) {
    return { error: "Promo code does not apply to this package." as const };
  }

  return { promo };
}

export function isPromoRedemptionUniqueError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

type RedeemPromoInput = {
  promoCodeId: string;
  userId: string;
  context: PromoContext;
  referenceId?: string | null;
  discountAmount?: number | null;
  resultingPlan?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function redeemPromoCode(input: RedeemPromoInput) {
  return prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<
      Array<{
        id: string;
        active: boolean;
        startsAt: Date | null;
        expiresAt: Date | null;
        target: string;
        maxRedemptions: number | null;
        redemptionsCount: number;
      }>
    >`SELECT "id","active","startsAt","expiresAt","target","maxRedemptions","redemptionsCount"
      FROM "PromoCode" WHERE "id" = ${input.promoCodeId} FOR UPDATE`;

    const promo = lockedRows[0];
    if (!promo || !promo.active) return { ok: false as const, reason: "invalid" as const };

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) return { ok: false as const, reason: "not_started" as const };
    if (promo.expiresAt && promo.expiresAt < now) return { ok: false as const, reason: "expired" as const };
    if (promo.target !== "ANY" && promo.target !== input.context) {
      return { ok: false as const, reason: "target_mismatch" as const };
    }
    if (promo.maxRedemptions != null && promo.redemptionsCount >= promo.maxRedemptions) {
      return { ok: false as const, reason: "limit_reached" as const };
    }

    const alreadyUsed = await tx.promoCodeRedemption.findUnique({
      where: {
        promoCodeId_userId_context: {
          promoCodeId: input.promoCodeId,
          userId: input.userId,
          context: input.context,
        },
      },
      select: { id: true },
    });
    if (alreadyUsed) return { ok: false as const, reason: "already_used" as const };

    await tx.promoCodeRedemption.create({
      data: {
        promoCodeId: input.promoCodeId,
        userId: input.userId,
        context: input.context,
        referenceId: input.referenceId ?? null,
        discountAmount: input.discountAmount ?? null,
        resultingPlan: input.resultingPlan ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
    await tx.promoCode.update({
      where: { id: input.promoCodeId },
      data: { redemptionsCount: { increment: 1 } },
    });
    return { ok: true as const };
  });
}

export function computeDiscountedAmount(baseAmount: number, promo: { kind: string; amount: number | null }) {
  if (promo.kind === "FREE_YEAR_SUBSCRIPTION") return 0;
  if (promo.kind === "DISCOUNT_PERCENT") {
    const pct = Math.max(0, Math.min(100, promo.amount ?? 0));
    return Math.max(0, Math.round((baseAmount * (1 - pct / 100)) * 100) / 100);
  }
  if (promo.kind === "DISCOUNT_FIXED") {
    return Math.max(0, Math.round((baseAmount - (promo.amount ?? 0)) * 100) / 100);
  }
  return baseAmount;
}
