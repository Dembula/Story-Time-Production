import { prisma } from "@/lib/prisma";
import {
  computeEquipmentRequestBaseZar,
  computeLocationBookingBaseZar,
  computeMarketplaceFeeZar,
  DEFAULT_CASTING_INQUIRY_BASE_ZAR,
  DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR,
  MARKETPLACE_TRANSACTION_TYPE,
  type MarketplaceTransactionType,
} from "@/lib/financial-ledger";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { settleMarketplaceWithWallet } from "@/lib/payments/marketplace-wallet";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";

const db = prisma as typeof prisma & {
  paymentRecord: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      userId: string | null;
      amount: number;
      status: string;
      relatedEntityType: string | null;
      relatedEntityId: string | null;
    } | null>;
  };
};

export type MarketplaceEntityType =
  | "EquipmentRequest"
  | "LocationBooking"
  | "CateringBooking"
  | "CrewTeamRequest"
  | "CastingInquiry";

export type MarketplaceSettlementQuote = {
  entityType: MarketplaceEntityType;
  entityId: string;
  buyerUserId: string;
  sellerUserId: string;
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  transactionType: MarketplaceTransactionType;
  escrowIdempotencyKey: string;
  purpose: string;
};

const PURPOSE_BY_TYPE: Record<MarketplaceEntityType, string> = {
  EquipmentRequest: "EQUIPMENT_REQUEST",
  LocationBooking: "LOCATION_BOOKING",
  CateringBooking: "CATERING_BOOKING",
  CrewTeamRequest: "CREW_REQUEST",
  CastingInquiry: "CAST_INQUIRY",
};

export async function resolveMarketplaceSettlement(
  entityType: MarketplaceEntityType,
  entityId: string,
  buyerUserId: string,
): Promise<{ ok: true; quote: MarketplaceSettlementQuote } | { ok: false; error: string; status: number }> {
  if (entityType === "EquipmentRequest") {
    const row = await prisma.equipmentRequest.findUnique({
      where: { id: entityId, requesterId: buyerUserId },
      include: { equipment: { select: { description: true } } },
    });
    if (!row) return { ok: false, error: "Request not found", status: 404 };
    if (row.paymentTransactionId) return { ok: false, error: "Already paid", status: 400 };
    if (row.status !== "APPROVED") {
      return { ok: false, error: "Equipment request must be approved before payment", status: 400 };
    }
    const baseAmount = computeEquipmentRequestBaseZar({
      equipmentDescription: row.equipment.description,
      startDate: row.startDate,
      endDate: row.endDate,
    });
    const feeAmount = computeMarketplaceFeeZar(baseAmount);
    const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
    return {
      ok: true,
      quote: {
        entityType,
        entityId,
        buyerUserId,
        sellerUserId: row.companyId,
        baseAmount,
        feeAmount,
        totalAmount,
        transactionType: MARKETPLACE_TRANSACTION_TYPE.EQUIPMENT_REQUEST,
        escrowIdempotencyKey: `escrow_hold_equipment_${entityId}`,
        purpose: PURPOSE_BY_TYPE.EquipmentRequest,
      },
    };
  }

  if (entityType === "LocationBooking") {
    const row = await prisma.locationBooking.findUnique({
      where: { id: entityId, requesterId: buyerUserId },
      include: { location: { select: { dailyRate: true } } },
    });
    if (!row) return { ok: false, error: "Booking not found", status: 404 };
    if (row.paymentTransactionId) return { ok: false, error: "Already paid", status: 400 };
    if (row.status !== "APPROVED") {
      return { ok: false, error: "Booking must be approved before payment", status: 400 };
    }
    const baseAmount = computeLocationBookingBaseZar({
      dailyRate: row.location.dailyRate,
      startDate: row.startDate,
      endDate: row.endDate,
    });
    const feeAmount = computeMarketplaceFeeZar(baseAmount);
    const totalAmount = baseAmount + feeAmount;
    return {
      ok: true,
      quote: {
        entityType,
        entityId,
        buyerUserId,
        sellerUserId: row.ownerId,
        baseAmount,
        feeAmount,
        totalAmount,
        transactionType: MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING,
        escrowIdempotencyKey: `escrow_hold_location_${entityId}`,
        purpose: PURPOSE_BY_TYPE.LocationBooking,
      },
    };
  }

  if (entityType === "CateringBooking") {
    const row = await prisma.cateringBooking.findUnique({
      where: { id: entityId, creatorId: buyerUserId },
      include: { cateringCompany: { select: { userId: true, minOrder: true } } },
    });
    if (!row) return { ok: false, error: "Booking not found", status: 404 };
    if (row.paymentTransactionId) return { ok: false, error: "Already paid", status: 400 };
    if (row.status !== "APPROVED") {
      return { ok: false, error: "Catering booking must be approved before payment", status: 400 };
    }
    const baseAmount = row.cateringCompany.minOrder ?? 500;
    const feeAmount = computeMarketplaceFeeZar(baseAmount);
    const totalAmount = baseAmount + feeAmount;
    return {
      ok: true,
      quote: {
        entityType,
        entityId,
        buyerUserId,
        sellerUserId: row.cateringCompany.userId,
        baseAmount,
        feeAmount,
        totalAmount,
        transactionType: MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING,
        escrowIdempotencyKey: `escrow_hold_catering_${entityId}`,
        purpose: PURPOSE_BY_TYPE.CateringBooking,
      },
    };
  }

  if (entityType === "CrewTeamRequest") {
    const row = await prisma.crewTeamRequest.findUnique({
      where: { id: entityId, creatorId: buyerUserId },
      include: { crewTeam: { select: { userId: true } } },
    });
    if (!row) return { ok: false, error: "Request not found", status: 404 };
    if (row.paymentTransactionId) return { ok: false, error: "Already paid", status: 400 };
    if (row.status !== "ACCEPTED") {
      return { ok: false, error: "Crew request must be accepted before payment", status: 400 };
    }
    const baseAmount = DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR;
    const feeAmount = computeMarketplaceFeeZar(baseAmount);
    const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
    return {
      ok: true,
      quote: {
        entityType,
        entityId,
        buyerUserId,
        sellerUserId: row.crewTeam.userId,
        baseAmount,
        feeAmount,
        totalAmount,
        transactionType: MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST,
        escrowIdempotencyKey: `escrow_hold_crew_${entityId}`,
        purpose: PURPOSE_BY_TYPE.CrewTeamRequest,
      },
    };
  }

  const row = await prisma.castingInquiry.findUnique({
    where: { id: entityId, creatorId: buyerUserId },
    include: { agency: { select: { userId: true } } },
  });
  if (!row) return { ok: false, error: "Inquiry not found", status: 404 };
  if (row.paymentTransactionId) return { ok: false, error: "Already paid", status: 400 };
  const baseAmount = DEFAULT_CASTING_INQUIRY_BASE_ZAR;
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
  return {
    ok: true,
    quote: {
      entityType: "CastingInquiry",
      entityId,
      buyerUserId,
      sellerUserId: row.agency.userId,
      baseAmount,
      feeAmount,
      totalAmount,
      transactionType: MARKETPLACE_TRANSACTION_TYPE.CAST_INQUIRY,
      escrowIdempotencyKey: `escrow_hold_casting_${entityId}`,
      purpose: PURPOSE_BY_TYPE.CastingInquiry,
    },
  };
}

async function attachTransactionToEntity(quote: MarketplaceSettlementQuote, transactionId: string) {
  const data = { paymentTransactionId: transactionId };
  switch (quote.entityType) {
    case "EquipmentRequest":
      await prisma.equipmentRequest.update({ where: { id: quote.entityId }, data });
      break;
    case "LocationBooking":
      await prisma.locationBooking.update({ where: { id: quote.entityId }, data });
      break;
    case "CateringBooking":
      await prisma.cateringBooking.update({ where: { id: quote.entityId }, data });
      break;
    case "CrewTeamRequest":
      await prisma.crewTeamRequest.update({ where: { id: quote.entityId }, data });
      break;
    case "CastingInquiry":
      await prisma.castingInquiry.update({ where: { id: quote.entityId }, data });
      break;
  }
}

export async function finalizeMarketplaceWalletPayment(quote: MarketplaceSettlementQuote) {
  const walletSettle = await settleMarketplaceWithWallet({
    buyerUserId: quote.buyerUserId,
    sellerUserId: quote.sellerUserId,
    baseAmount: quote.baseAmount,
    feeAmount: quote.feeAmount,
    totalAmount: quote.totalAmount,
    referenceType: quote.entityType,
    referenceId: quote.entityId,
    escrowIdempotencyKey: quote.escrowIdempotencyKey,
  });
  if (!walletSettle.ok) {
    return { ok: false as const, error: walletSettle.error };
  }

  const tx = await prisma.transaction.create({
    data: {
      payerId: quote.buyerUserId,
      payeeId: quote.sellerUserId,
      amount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      totalAmount: quote.totalAmount,
      status: "COMPLETED",
      type: quote.transactionType,
      referenceId: quote.entityId,
      externalPaymentId: null,
    },
  });

  await attachTransactionToEntity(quote, tx.id);

  return {
    ok: true as const,
    transactionId: tx.id,
    paymentMode: "wallet" as const,
    baseAmount: quote.baseAmount,
    feeAmount: quote.feeAmount,
    totalAmount: quote.totalAmount,
  };
}

/** After Stitch succeeds: move treasury inflow into escrow + platform fee, then mark marketplace row paid. */
export async function finalizeMarketplaceGatewayPayment(paymentRecordId: string) {
  const record = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
  });

  if (!record?.userId || !record.relatedEntityType || !record.relatedEntityId) {
    return { ok: false as const, error: "Invalid payment record" };
  }

  const entityType = record.relatedEntityType as MarketplaceEntityType;
  const resolved = await resolveMarketplaceSettlement(entityType, record.relatedEntityId, record.userId);
  if (!resolved.ok) {
    if (resolved.error === "Already paid") return { ok: true as const, paymentMode: "stitch" as const, alreadyPaid: true };
    return { ok: false as const, error: resolved.error };
  }

  const quote = resolved.quote;
  if (Math.abs(record.amount - quote.totalAmount) > 0.02) {
    return { ok: false as const, error: "Payment amount mismatch" };
  }

  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);
  await ensureWalletForUser(quote.buyerUserId);
  await ensureWalletForUser(quote.sellerUserId);

  await postBalancedLedgerBatch({
    idempotencyKey: `gateway_marketplace_${paymentRecordId}_treasury_debit`,
    referenceType: quote.entityType,
    referenceId: quote.entityId,
    metadata: { paymentRecordId, flow: "marketplace_gateway" },
    entries: [
      {
        userId: treasuryUserId,
        direction: "DEBIT",
        accountType: "AVAILABLE",
        transactionType: "marketplace_gateway_settle",
        amount: quote.totalAmount,
      },
      {
        userId: quote.buyerUserId,
        direction: "CREDIT",
        accountType: "LOCKED",
        transactionType: "escrow_hold",
        amount: quote.baseAmount,
      },
      ...(quote.feeAmount > 0
        ? [
            {
              userId: treasuryUserId,
              direction: "CREDIT" as const,
              accountType: "PLATFORM_REVENUE" as const,
              transactionType: "marketplace_fee",
              amount: quote.feeAmount,
            },
          ]
        : []),
    ],
  });

  const buyerWallet = await ensureWalletForUser(quote.buyerUserId);
  const sellerWallet = await ensureWalletForUser(quote.sellerUserId);
  await (db as { escrowAccount: { upsert: (args: unknown) => Promise<unknown> } }).escrowAccount.upsert({
    where: {
      referenceType_referenceId: {
        referenceType: quote.entityType,
        referenceId: quote.entityId,
      },
    },
    create: {
      referenceType: quote.entityType,
      referenceId: quote.entityId,
      buyerWalletId: buyerWallet.id,
      sellerWalletId: sellerWallet.id,
      amount: quote.baseAmount,
      status: "HELD",
      releaseTrigger: "MANUAL_CONFIRMATION",
    },
    update: { status: "HELD", amount: quote.baseAmount },
  });

  const tx = await prisma.transaction.create({
    data: {
      payerId: quote.buyerUserId,
      payeeId: quote.sellerUserId,
      amount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      totalAmount: quote.totalAmount,
      status: "COMPLETED",
      type: quote.transactionType,
      referenceId: quote.entityId,
      externalPaymentId: paymentRecordId,
    },
  });

  await attachTransactionToEntity(quote, tx.id);

  return {
    ok: true as const,
    transactionId: tx.id,
    paymentMode: "stitch" as const,
  };
}
