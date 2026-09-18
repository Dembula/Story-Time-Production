import "server-only";

import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { splitViewerRevenue } from "@/lib/payments/fees";
import { STORYTIME_TRANSACTION_FEE_LABEL } from "@/lib/payments/config";
import { getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import {
  resolveMarketplaceSettlement,
  type MarketplaceEntityType,
} from "@/lib/payments/marketplace-settlement";
import { resolveSyncLicensingSettlement } from "@/lib/payments/sync-licensing-settlement";
import { resolveFundingDealSettlement } from "@/lib/payments/funding-deal-settlement";
import { resolveContractHireSettlement } from "@/lib/payments/contract-hire-settlement";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";
import {
  CREATOR_APPLE_IAP_LICENSE_PURPOSE,
  CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
} from "@/lib/payments/apple-iap/purposes";

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
  CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
  "creator_pipeline_yearly",
  "creator_pipeline_monthly",
  "creator_pipeline_monthly_renewal",
  "creator_pipeline_yearly_renewal",
  "creator_upload_only_yearly_renewal",
  "creator_upload_only_yearly",
  "creator_distribution_yearly",
  "creator_distribution_per_upload",
  CREATOR_APPLE_IAP_LICENSE_PURPOSE,
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

/** Book gateway cash + vendor pending + platform fee for marketplace-style deals. */
async function allocatePayeeGatewayLedger(args: {
  idempotencyKey: string;
  paymentId: string;
  relatedEntityType: string;
  relatedEntityId: string;
  flow: string;
  grossAmount: number;
  settlementAmount: number;
  providerFeeAmount: number;
  sellerUserId: string;
  baseAmount: number;
  feeAmount: number;
  incomingDescription: string;
  pendingDescription: string;
}) {
  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);
  await ensureWalletForUser(args.sellerUserId);

  const credits: LedgerEntry[] = [
    {
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "AVAILABLE",
      transactionType: "incoming_payment",
      amount: args.settlementAmount,
      description: args.incomingDescription,
    },
    {
      userId: args.sellerUserId,
      direction: "CREDIT",
      accountType: "PENDING",
      transactionType: "marketplace_vendor_pending",
      amount: args.baseAmount,
      description: args.pendingDescription,
    },
  ];

  if (args.feeAmount > 0) {
    credits.push({
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "PLATFORM_REVENUE",
      transactionType: "storytime_transaction_fee",
      amount: args.feeAmount,
      description: STORYTIME_TRANSACTION_FEE_LABEL,
    });
  }

  const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
  await postBalancedLedgerBatch({
    idempotencyKey: args.idempotencyKey,
    referenceType: args.relatedEntityType,
    referenceId: args.relatedEntityId,
    metadata: {
      paymentRecordId: args.paymentId,
      flow: args.flow,
      grossAmount: args.grossAmount,
      settlementAmount: args.settlementAmount,
      providerFeeAmount: args.providerFeeAmount,
      baseAmount: args.baseAmount,
      feeAmount: args.feeAmount,
    },
    entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
  });
}

/** Book treasury cash + revenue classification when a gateway payment succeeds. */
export async function allocateGatewayPaymentLedger(payment: {
  id: string;
  amount: number;
  settlementAmount?: number;
  providerFeeAmount?: number;
  purpose?: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);

  const idempotencyKey = `gateway_allocate_${payment.id}`;
  const purpose = payment.purpose ?? "";
  const grossAmount = payment.amount;
  const settlementAmount = payment.settlementAmount ?? grossAmount;
  const providerFeeAmount = payment.providerFeeAmount ?? Math.max(0, grossAmount - settlementAmount);

  if (payment.relatedEntityType === "SyncRequest" && payment.relatedEntityId) {
    const { prisma } = await import("@/lib/prisma");
    const full = await (prisma as any).paymentRecord.findUnique({
      where: { id: payment.id },
      select: { userId: true },
    });
    if (!full?.userId) return;

    const resolved = await resolveSyncLicensingSettlement(
      payment.relatedEntityId,
      full.userId,
    );
    if (!resolved.ok) return;

    const quote = resolved.quote;
    if (Math.abs(grossAmount - quote.totalAmount) > 0.02) {
      console.error("sync licensing gateway amount mismatch", payment.id, grossAmount, quote.totalAmount);
      return;
    }

    await allocatePayeeGatewayLedger({
      idempotencyKey,
      paymentId: payment.id,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      flow: "sync_licensing_gateway",
      grossAmount,
      settlementAmount,
      providerFeeAmount,
      sellerUserId: quote.sellerUserId,
      baseAmount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      incomingDescription: "Sync licensing gateway payment received (net after PayFast fees)",
      pendingDescription: "Pending sync licensing earnings",
    });
    return;
  }

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
    if (Math.abs(grossAmount - quote.totalAmount) > 0.02) {
      console.error("marketplace gateway amount mismatch", payment.id, grossAmount, quote.totalAmount);
      return;
    }

    await allocatePayeeGatewayLedger({
      idempotencyKey,
      paymentId: payment.id,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      flow: "marketplace_gateway",
      grossAmount,
      settlementAmount,
      providerFeeAmount,
      sellerUserId: quote.sellerUserId,
      baseAmount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      incomingDescription: "Marketplace gateway payment received (net after PayFast fees)",
      pendingDescription: "Pending vendor earnings (paid out monthly)",
    });
    return;
  }

  if (payment.relatedEntityType === "InvestmentDeal" && payment.relatedEntityId) {
    const { prisma } = await import("@/lib/prisma");
    const full = await (prisma as any).paymentRecord.findUnique({
      where: { id: payment.id },
      select: { userId: true },
    });
    if (!full?.userId) return;

    const resolved = await resolveFundingDealSettlement(payment.relatedEntityId, full.userId);
    if (!resolved.ok) return;

    const quote = resolved.quote;
    if (Math.abs(grossAmount - quote.totalAmount) > 0.02) {
      console.error("investment deal gateway amount mismatch", payment.id, grossAmount, quote.totalAmount);
      return;
    }

    await allocatePayeeGatewayLedger({
      idempotencyKey,
      paymentId: payment.id,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      flow: "investment_deal_gateway",
      grossAmount,
      settlementAmount,
      providerFeeAmount,
      sellerUserId: quote.payeeUserId,
      baseAmount: quote.baseAmount,
      feeAmount: quote.feeAmount,
      incomingDescription: "Investment deal gateway payment received (net after PayFast fees)",
      pendingDescription: "Pending investment funds for creator",
    });
    return;
  }

  if (payment.relatedEntityType === "ProjectContract" && payment.relatedEntityId) {
    const { prisma } = await import("@/lib/prisma");
    const full = await (prisma as any).paymentRecord.findUnique({
      where: { id: payment.id },
      select: { userId: true, metadata: true },
    });
    if (!full?.userId) return;
    const meta =
      full.metadata && typeof full.metadata === "object"
        ? (full.metadata as Record<string, unknown>)
        : {};
    const projectId = typeof meta.projectId === "string" ? meta.projectId : null;
    if (!projectId) return;

    const resolved = await resolveContractHireSettlement(
      payment.relatedEntityId,
      projectId,
      full.userId,
    );
    if (!resolved.ok) return;

    const quote = resolved.quote;
    if (Math.abs(grossAmount - quote.totalAmount) > 0.02) {
      console.error("contract hire gateway amount mismatch", payment.id, grossAmount, quote.totalAmount);
      return;
    }

    await allocatePayeeGatewayLedger({
      idempotencyKey,
      paymentId: payment.id,
      relatedEntityType: payment.relatedEntityType,
      relatedEntityId: payment.relatedEntityId,
      flow: "contract_hire_gateway",
      grossAmount,
      settlementAmount,
      providerFeeAmount,
      sellerUserId: quote.payeeUserId,
      baseAmount: quote.baseAmount,
      feeAmount: quote.platformFeeAmount,
      incomingDescription: "Contract hire gateway payment received (net after PayFast fees)",
      pendingDescription: "Pending contract hire earnings",
    });
    return;
  }

  if (isViewerPoolPaymentPurpose(purpose)) {
    const feeSettings = await getFinanceFeeSettings();
    const { isCreatorRevenueTrackingEnabled } = await import("@/lib/finance/revenue-connector");
    const { isClearedCreatorPoolEligiblePayment } = await import("@/lib/finance/revenue-eligibility");
    const creatorsTracking = await isCreatorRevenueTrackingEnabled();

    const { prisma } = await import("@/lib/prisma");
    const fullPayment = await (prisma as any).paymentRecord.findUnique({
      where: { id: payment.id },
      select: {
        amount: true,
        settlementAmount: true,
        status: true,
        purpose: true,
        provider: true,
        settlementSource: true,
        metadata: true,
        paidAt: true,
        fundsClearedAt: true,
        relatedEntityType: true,
        relatedEntityId: true,
      },
    });

    const poolEligible =
      creatorsTracking &&
      fullPayment &&
      (await isClearedCreatorPoolEligiblePayment(fullPayment));

    const split = poolEligible
      ? splitViewerRevenue(settlementAmount, feeSettings)
      : { creator: 0, platform: settlementAmount };
    const creatorPct = poolEligible ? Math.round(feeSettings.viewerCreatorSplit * 100) : 0;
    const platformPct = poolEligible ? Math.round(feeSettings.viewerPlatformSplit * 100) : 100;
    const poolLabel =
      purpose === "viewer_ppv" || purpose === "viewer_ppv_apple_iap"
        ? "Viewer PPV payment received"
        : "Viewer subscription payment received";
    const credits: LedgerEntry[] = [
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount: settlementAmount,
        description: `${poolLabel} (net after gateway fees)`,
      },
    ];
    if (split.creator > 0) {
      credits.push({
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "CREATOR_REVENUE",
        transactionType: "viewer_creator_pool",
        amount: split.creator,
        description: `Creator pool (${creatorPct}%) — distributed by watch time`,
      });
    }
    credits.push({
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "PLATFORM_REVENUE",
      transactionType: poolEligible ? "viewer_platform_share" : "viewer_platform_hold_while_paused",
      amount: split.platform,
      description: poolEligible
        ? `Story Time platform share (${platformPct}%)`
        : "Story Time platform hold — not yet in creator pool (uncleared, pre-cutoff, or grandfathered)",
    });
    const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
    await postBalancedLedgerBatch({
      idempotencyKey,
      referenceType: payment.relatedEntityType || "VIEWER_SUBSCRIPTION",
      referenceId: payment.relatedEntityId || payment.id,
      metadata: {
        paymentRecordId: payment.id,
        flow: "viewer_pool",
        purpose,
        grossAmount,
        settlementAmount,
        providerFeeAmount,
        creatorPool: split.creator,
        platformShare: split.platform,
        creatorRevenueTrackingEnabled: creatorsTracking,
        poolEligible: Boolean(poolEligible),
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
        amount: settlementAmount,
        description: "Platform payment received (net after PayFast fees)",
      },
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "platform_service_revenue",
        amount: settlementAmount,
        description: purpose.replace(/_/g, " "),
      },
    ];
    const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
    await postBalancedLedgerBatch({
      idempotencyKey,
      referenceType: payment.relatedEntityType || "PLATFORM_PAYMENT",
      referenceId: payment.relatedEntityId || payment.id,
      metadata: {
        paymentRecordId: payment.id,
        flow: "platform_revenue",
        purpose,
        grossAmount,
        settlementAmount,
        providerFeeAmount,
      },
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
      amount: settlementAmount,
      description: "Gateway payment received (net after PayFast fees)",
    },
    {
      userId: treasuryUserId,
      direction: "CREDIT",
      accountType: "PLATFORM_REVENUE",
      transactionType: "platform_service_revenue",
      amount: settlementAmount,
      description: purpose || "platform payment",
    },
  ];
  const creditTotal = credits.reduce((sum, entry) => sum + entry.amount, 0);
  await postBalancedLedgerBatch({
    idempotencyKey,
    referenceType: payment.relatedEntityType || "PAYMENT_RECORD",
    referenceId: payment.relatedEntityId || payment.id,
    metadata: {
      paymentRecordId: payment.id,
      flow: "default_platform",
      grossAmount,
      settlementAmount,
      providerFeeAmount,
    },
    entries: [...credits, balancingLockedDebit(treasuryUserId, creditTotal)],
  });
}
