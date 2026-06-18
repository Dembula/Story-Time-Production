import "server-only";

import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { splitViewerRevenue } from "@/lib/payments/fees";
import { STORYTIME_TRANSACTION_FEE_LABEL } from "@/lib/payments/config";
import {
  resolveMarketplaceSettlement,
  type MarketplaceEntityType,
} from "@/lib/payments/marketplace-settlement";

const VIEWER_POOL_PURPOSES = new Set([
  "viewer_subscription",
  "viewer_subscription_renewal",
  "viewer_ppv",
]);

const PLATFORM_REVENUE_PURPOSES = new Set([
  "SCRIPT_REVIEW",
  "CASTING_ACQUISITION_FEE",
  "AUDITION_LISTING",
  "COMPANY_SUBSCRIPTION",
  "COMPANY_SUBSCRIPTION_RENEWAL",
  "CREATOR_YEARLY_LICENSE",
  "CREATOR_CONTENT_UPLOAD",
  "CREATOR_MUSIC_UPLOAD",
  "creator_film_upload",
  "creator_pipeline_yearly",
  "creator_pipeline_monthly",
  "creator_pipeline_monthly_renewal",
  "creator_pipeline_yearly_renewal",
  "creator_upload_only_yearly_renewal",
  "creator_upload_only_yearly",
  "creator_distribution_yearly",
  "creator_distribution_per_upload",
  "music_track_publish",
]);

const MARKETPLACE_ENTITY_TYPES = new Set<string>([
  "EquipmentRequest",
  "LocationBooking",
  "CateringBooking",
  "CrewTeamRequest",
  "CastingInquiry",
]);

type LedgerEntry = Parameters<typeof postBalancedLedgerBatch>[0]["entries"][number];

function balancingLockedDebit(treasuryUserId: string, creditTotal: number): LedgerEntry {
  return {
    userId: treasuryUserId,
    direction: "DEBIT",
    accountType: "LOCKED",
    transactionType: "gateway_balance",
    amount: creditTotal,
    description: "Gateway ledger balance",
  };
}

/** Book treasury cash + revenue classification when a gateway payment succeeds. */
export async function allocateGatewayPaymentLedger(payment: {
  id: string;
  amount: number;
  purpose?: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);

  const idempotencyKey = `gateway_allocate_${payment.id}`;
  const purpose = payment.purpose ?? "";
  const amount = payment.amount;

  if (
    payment.relatedEntityType &&
    MARKETPLACE_ENTITY_TYPES.has(payment.relatedEntityType) &&
    payment.relatedEntityId
  ) {
    const { prisma } = await import("@/lib/prisma");
    const full = await (prisma as any).paymentRecord.findUnique({
      where: { id: payment.id },
      select: { userId: true },
    });
    if (!full?.userId) return;

    const resolved = await resolveMarketplaceSettlement(
      payment.relatedEntityType as MarketplaceEntityType,
      payment.relatedEntityId,
      full.userId,
    );
    if (!resolved.ok) return;

    const quote = resolved.quote;
    if (Math.abs(amount - quote.totalAmount) > 0.02) {
      console.error("marketplace gateway amount mismatch", payment.id, amount, quote.totalAmount);
      return;
    }

    await ensureWalletForUser(quote.sellerUserId);

    const credits: LedgerEntry[] = [
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount: quote.totalAmount,
        description: "Marketplace gateway payment received",
      },
      {
        userId: quote.sellerUserId,
        direction: "CREDIT",
        accountType: "PENDING",
        transactionType: "marketplace_vendor_pending",
        amount: quote.baseAmount,
        description: "Pending vendor earnings (paid out monthly)",
      },
    ];

    if (quote.feeAmount > 0) {
      credits.push({
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "storytime_transaction_fee",
        amount: quote.feeAmount,
        description: STORYTIME_TRANSACTION_FEE_LABEL,
      });
    }

    const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
    await postBalancedLedgerBatch({
      idempotencyKey,
      referenceType: payment.relatedEntityType,
      referenceId: payment.relatedEntityId,
      metadata: {
        paymentRecordId: payment.id,
        flow: "marketplace_gateway",
        baseAmount: quote.baseAmount,
        feeAmount: quote.feeAmount,
        feeLabel: STORYTIME_TRANSACTION_FEE_LABEL,
      },
      entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
    });
    return;
  }

  if (VIEWER_POOL_PURPOSES.has(purpose)) {
    const split = splitViewerRevenue(amount);
    const poolLabel =
      purpose === "viewer_ppv" ? "Viewer PPV payment received" : "Viewer subscription payment received";
    const credits: LedgerEntry[] = [
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount,
        description: poolLabel,
      },
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "CREATOR_REVENUE",
        transactionType: "viewer_creator_pool",
        amount: split.creator,
        description: "Creator pool (60%) — distributed by watch time",
      },
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "viewer_platform_share",
        amount: split.platform,
        description: "Story Time platform share (40%)",
      },
    ];
    const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
    await postBalancedLedgerBatch({
      idempotencyKey,
      referenceType: payment.relatedEntityType || "VIEWER_SUBSCRIPTION",
      referenceId: payment.relatedEntityId || payment.id,
      metadata: {
        paymentRecordId: payment.id,
        flow: "viewer_pool",
        purpose,
        creatorPool: split.creator,
        platformShare: split.platform,
      },
      entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
    });
    return;
  }

  if (PLATFORM_REVENUE_PURPOSES.has(purpose) || purpose.includes("subscription") || purpose.includes("license")) {
    const credits: LedgerEntry[] = [
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount,
        description: "Platform payment received",
      },
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "platform_service_revenue",
        amount,
        description: purpose.replace(/_/g, " "),
      },
    ];
    const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
    await postBalancedLedgerBatch({
      idempotencyKey,
      referenceType: payment.relatedEntityType || "PLATFORM_PAYMENT",
      referenceId: payment.relatedEntityId || payment.id,
      metadata: { paymentRecordId: payment.id, flow: "platform_revenue", purpose },
      entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
    });
    return;
  }

  // Default: credit treasury cash only (balanced)
  const credits: LedgerEntry[] = [
    {
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "AVAILABLE",
      transactionType: "incoming_payment",
      amount,
      description: "Gateway payment received",
    },
    {
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "PLATFORM_REVENUE",
      transactionType: "platform_service_revenue",
      amount,
      description: purpose || "platform payment",
    },
  ];
  const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
  await postBalancedLedgerBatch({
    idempotencyKey,
    referenceType: payment.relatedEntityType || "PAYMENT_RECORD",
    referenceId: payment.relatedEntityId || payment.id,
    metadata: { paymentRecordId: payment.id, flow: "default_platform" },
    entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
  });
}
