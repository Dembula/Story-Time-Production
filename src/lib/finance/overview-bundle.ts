import "server-only";

import { prisma } from "@/lib/prisma";
import {
  getCashSettlementAmount,
  isCashRecognizedPayment,
  paymentFundingSource,
} from "@/lib/payments/cash-recognition";
import {
  APPLE_FUNDS_CLEAR_DAYS,
  PAYFAST_FUNDS_CLEAR_DAYS,
  describeFundsClearStatus,
} from "@/lib/payments/funds-clearing-policy";
import { ensureCreatorRevenueTrackingLive, getRevenueConnector } from "@/lib/finance/revenue-connector";
import { isClearedCreatorPoolEligiblePayment } from "@/lib/finance/revenue-eligibility";
import { resolveCreatorRevenueTrackingStart } from "@/lib/finance/revenue-tracking-start";
import { getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { splitViewerRevenueWithRates } from "@/lib/finance/fee-math";
import { resolveFinancePeriodRange, type FinancePeriodKey } from "@/lib/finance/period-range";
import { aggregateCompletedMarketplaceFees } from "@/lib/financial-ledger";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";
import { roundMoney } from "@/lib/payments/config";
import { getViewerPlanConfigById } from "@/lib/pricing";
import {
  hasCreatorPoolDistribution,
  getPreviousCalendarMonthRange,
} from "@/lib/payments/creator-pool-distribution";
import {
  categorizePaymentPurpose,
  fetchEscrowAndTreasury,
  fetchFundingMoney,
  fetchPromoLiability,
  paymentPurposeLabel,
  type FundingMoneyBundle,
  type PromoLiabilityBundle,
  type RetentionBreakdownBundle,
} from "@/lib/finance/finance-insights";

const db = prisma as any;

export type FinanceSheetRow = {
  id: string;
  kind: "payment" | "marketplace" | "trial";
  paidAt: string | null;
  provider: string;
  purpose: string;
  purposeLabel: string;
  gross: number;
  gatewayFee: number;
  net: number;
  platformShare: number;
  creatorShare: number;
  settlementSource: string | null;
  currency: string;
  fundingSource: "cash" | "promo" | "demo" | "other" | "trial";
  status: string;
  fundsClearStatus: "cleared" | "pending" | "not_applicable";
  fundsClearLabel: string;
  fundsClearDueAt: string | null;
  fundsClearedAt: string | null;
  fundsClearDaysRemaining: number | null;
  fundsClearDelayDays: number | null;
  canClearEarly: boolean;
  payer: { id: string | null; name: string | null; email: string | null };
  payee: { id: string | null; name: string | null; email: string | null } | null;
};

export type FinanceOverviewBundle = {
  period: {
    key: FinancePeriodKey;
    label: string;
    periodStart: string;
    periodEnd: string;
  };
  feeSettings: {
    appleCommissionRate: number;
    viewerCreatorSplit: number;
    viewerPlatformSplit: number;
    marketplaceFeeRate: number;
  };
  totals: {
    gross: number;
    gatewayFees: number;
    net: number;
    viewerPoolNet: number;
    creatorPool: number;
    platformRetained: number;
    platformServiceRevenue: number;
    platformTotalRetained: number;
    marketplaceFees: number;
    marketplaceVolume: number;
    paymentCount: number;
    marketplaceTxCount: number;
    promoLiabilityZar: number;
    fundingSettledZar: number;
    /** Cash recognized but not yet cleared (awaiting PayFast 3d / Apple 45d). */
    pendingClearNet: number;
    pendingClearCount: number;
    /** List price of active free trials in the period. Not included in gross, net, or pool. */
    trialPotentialZar: number;
    trialCount: number;
  };
  revenueTracking: {
    enabled: boolean;
    trackingStartedAt: string | null;
    note: string | null;
    clearRules: { payfastDays: number; appleDays: number };
  };
  byProvider: Array<{
    provider: string;
    count: number;
    gross: number;
    fees: number;
    net: number;
  }>;
  bySettlementSource: Array<{
    source: string;
    count: number;
    fees: number;
    net: number;
  }>;
  gateways: {
    payfastItnFees: number;
    payfastEstimatedFees: number;
    appleEstimatedFees: number;
    appleProceedsFees: number;
    webhookEventsInPeriod: number;
  };
  payouts: {
    pendingCount: number;
    pendingAmount: number;
    paidCount: number;
    paidAmount: number;
    previousMonthPoolDistributed: boolean;
    previousMonthPeriodKey: string;
  };
  series: Array<{ date: string; gross: number; fees: number; net: number }>;
  sheets: FinanceSheetRow[];
  marketplaceSheets: FinanceSheetRow[];
  trialSheets: FinanceSheetRow[];
  promo: PromoLiabilityBundle;
  funding: FundingMoneyBundle;
  retention: RetentionBreakdownBundle;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchFinanceOverviewBundle(options: {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  sheetLimit?: number;
}): Promise<FinanceOverviewBundle> {
  // Pin creator-revenue tracking to 18 Sep 2026 go-live (PayFast 3d / Apple 45d clear clocks).
  await ensureCreatorRevenueTrackingLive({
    note: "Creator revenue recording live from 18 Sep 2026 — cleared PayFast/Apple cash only; existing subs on next renewal.",
  }).catch((err) => console.warn("[finance] ensure revenue tracking failed", err));

  const connector = await getRevenueConnector();
  await import("@/lib/payments/funds-clearing")
    .then(({ stripPreTrackingFundsClearClocks }) =>
      stripPreTrackingFundsClearClocks(connector.trackingStartedAt),
    )
    .catch((err) => console.warn("[finance] strip pre-tracking clear clocks failed", err));

  const range = resolveFinancePeriodRange({
    period: options.period,
    from: options.from,
    to: options.to,
  });
  const feeSettings = await getFinanceFeeSettings();
  const sheetLimit = Math.min(500, Math.max(50, options.sheetLimit ?? 200));

  const trialWindowEnd = new Date(range.periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [payments, marketplace, webhookEvents, pendingPayouts, paidPayouts, marketplaceTxs, activeTrials] =
    await Promise.all([
      prisma.paymentRecord.findMany({
        where: {
          status: "SUCCEEDED",
          paidAt: { gte: range.periodStart, lte: range.periodEnd },
        },
        select: {
          id: true,
          amount: true,
          providerFeeAmount: true,
          settlementAmount: true,
          status: true,
          purpose: true,
          provider: true,
          settlementSource: true,
          metadata: true,
          currency: true,
          paidAt: true,
          email: true,
          userId: true,
          relatedEntityType: true,
          relatedEntityId: true,
          fundsClearDueAt: true,
          fundsClearedAt: true,
          fundsClearedMode: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { paidAt: "desc" },
      }),
      aggregateCompletedMarketplaceFees(range.periodStart, range.periodEnd),
      prisma.paymentWebhookEvent.count({
        where: { createdAt: { gte: range.periodStart, lte: range.periodEnd } },
      }),
      db.payoutRequest.aggregate({
        where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      db.payoutRequest.aggregate({
        where: {
          status: "PAID",
          updatedAt: { gte: range.periodStart, lte: range.periodEnd },
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.transaction.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: range.periodStart, lte: range.periodEnd },
        },
        include: {
          payer: { select: { id: true, name: true, email: true } },
          payee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: sheetLimit,
      }),
      prisma.viewerSubscription.findMany({
        where: {
          status: "TRIAL_ACTIVE",
          viewerModel: "SUBSCRIPTION",
          trialEndsAt: { gte: range.periodStart, lte: trialWindowEnd },
        },
        select: {
          id: true,
          plan: true,
          status: true,
          trialEndsAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { trialEndsAt: "desc" },
        take: sheetLimit,
      }),
    ]);

  const cashPayments = payments.filter((p) => isCashRecognizedPayment(p));

  let gross = 0;
  let gatewayFees = 0;
  let net = 0;
  let viewerPoolNet = 0;
  let serviceRevenueNet = 0;
  let pendingClearNet = 0;
  let pendingClearCount = 0;
  let payfastItnFees = 0;
  let payfastEstimatedFees = 0;
  let appleEstimatedFees = 0;
  let appleProceedsFees = 0;
  let clearedPaymentCount = 0;

  const byProviderMap = new Map<string, { count: number; gross: number; fees: number; net: number }>();
  const bySourceMap = new Map<string, { count: number; fees: number; net: number }>();
  const seriesMap = new Map<string, { gross: number; fees: number; net: number }>();
  const byPurposeMap = new Map<
    string,
    {
      purpose: string;
      purposeLabel: string;
      count: number;
      gross: number;
      gatewayFees: number;
      net: number;
      platformShare: number;
      creatorShare: number;
      category: RetentionBreakdownBundle["byPurpose"][number]["category"];
    }
  >();

  const sheets: FinanceSheetRow[] = [];

  for (const p of cashPayments) {
    const g = roundMoney(Number(p.amount) || 0);
    const settlement = getCashSettlementAmount(p);
    const fee =
      p.providerFeeAmount != null && Number.isFinite(Number(p.providerFeeAmount))
        ? roundMoney(Number(p.providerFeeAmount))
        : roundMoney(Math.max(0, g - settlement));

    const trackingStart = resolveCreatorRevenueTrackingStart(connector.trackingStartedAt);
    const clearInfo = describeFundsClearStatus({
      provider: p.provider,
      paidAt: p.paidAt,
      fundsClearDueAt: p.fundsClearDueAt,
      fundsClearedAt: p.fundsClearedAt,
      fundsClearedMode: p.fundsClearedMode,
      trackingStartedAt: trackingStart,
    });

    const isViewerPool = isViewerPoolPaymentPurpose(p.purpose);
    const poolEligible = isViewerPool
      ? await isClearedCreatorPoolEligiblePayment(p, {
          trackingEnabled: connector.creatorRevenueTrackingEnabled,
          trackingStartedAt: trackingStart,
        })
      : clearInfo.status === "cleared";

    // KPI / pool math: only payments inside the tracking window that have cleared.
    if (clearInfo.status === "cleared") {
      clearedPaymentCount += 1;
      gross = roundMoney(gross + g);
      gatewayFees = roundMoney(gatewayFees + fee);
      net = roundMoney(net + settlement);

      const split = splitViewerRevenueWithRates(settlement, feeSettings);
      const platformShare = isViewerPool ? (poolEligible ? split.platform : settlement) : settlement;
      const creatorShare = isViewerPool && poolEligible ? split.creator : 0;

      if (isViewerPool && poolEligible) {
        viewerPoolNet = roundMoney(viewerPoolNet + settlement);
      } else {
        serviceRevenueNet = roundMoney(serviceRevenueNet + settlement);
      }

      const provider = String(p.provider || "UNKNOWN").toUpperCase();
      const prov = byProviderMap.get(provider) ?? { count: 0, gross: 0, fees: 0, net: 0 };
      prov.count += 1;
      prov.gross = roundMoney(prov.gross + g);
      prov.fees = roundMoney(prov.fees + fee);
      prov.net = roundMoney(prov.net + settlement);
      byProviderMap.set(provider, prov);

      const source = String(p.settlementSource || "unknown");
      const src = bySourceMap.get(source) ?? { count: 0, fees: 0, net: 0 };
      src.count += 1;
      src.fees = roundMoney(src.fees + fee);
      src.net = roundMoney(src.net + settlement);
      bySourceMap.set(source, src);

      if (source === "itn") payfastItnFees = roundMoney(payfastItnFees + fee);
      if (source === "estimated") payfastEstimatedFees = roundMoney(payfastEstimatedFees + fee);
      if (source === "apple_estimated" || source === "apple_iap") {
        appleEstimatedFees = roundMoney(appleEstimatedFees + fee);
      }
      if (source === "apple_proceeds") appleProceedsFees = roundMoney(appleProceedsFees + fee);

      if (p.paidAt) {
        const key = dayKey(p.paidAt);
        const day = seriesMap.get(key) ?? { gross: 0, fees: 0, net: 0 };
        day.gross = roundMoney(day.gross + g);
        day.fees = roundMoney(day.fees + fee);
        day.net = roundMoney(day.net + settlement);
        seriesMap.set(key, day);
      }

      const purposeKey = p.purpose || "unknown";
      const purposeRow = byPurposeMap.get(purposeKey) ?? {
        purpose: purposeKey,
        purposeLabel: paymentPurposeLabel(purposeKey),
        count: 0,
        gross: 0,
        gatewayFees: 0,
        net: 0,
        platformShare: 0,
        creatorShare: 0,
        category: categorizePaymentPurpose(purposeKey),
      };
      purposeRow.count += 1;
      purposeRow.gross = roundMoney(purposeRow.gross + g);
      purposeRow.gatewayFees = roundMoney(purposeRow.gatewayFees + fee);
      purposeRow.net = roundMoney(purposeRow.net + settlement);
      purposeRow.platformShare = roundMoney(purposeRow.platformShare + platformShare);
      purposeRow.creatorShare = roundMoney(purposeRow.creatorShare + creatorShare);
      byPurposeMap.set(purposeKey, purposeRow);
    } else if (clearInfo.status === "pending") {
      pendingClearNet = roundMoney(pendingClearNet + settlement);
      pendingClearCount += 1;
    }

    const splitForSheet = splitViewerRevenueWithRates(settlement, feeSettings);
    const sheetPlatform = isViewerPool ? splitForSheet.platform : settlement;
    const sheetCreator = isViewerPool ? splitForSheet.creator : 0;
    const provider = String(p.provider || "UNKNOWN").toUpperCase();

    if (sheets.length < sheetLimit) {
      sheets.push({
        id: p.id,
        kind: "payment",
        paidAt: p.paidAt?.toISOString() ?? null,
        provider,
        purpose: p.purpose,
        purposeLabel: paymentPurposeLabel(p.purpose),
        gross: g,
        gatewayFee: fee,
        net: settlement,
        platformShare: sheetPlatform,
        creatorShare: sheetCreator,
        settlementSource: p.settlementSource,
        currency: p.currency || "ZAR",
        fundingSource: paymentFundingSource(p),
        status: p.status,
        fundsClearStatus: clearInfo.status,
        fundsClearLabel: clearInfo.label,
        fundsClearDueAt: clearInfo.clearDueAt,
        fundsClearedAt: clearInfo.clearedAt,
        fundsClearDaysRemaining: clearInfo.daysRemaining,
        fundsClearDelayDays: clearInfo.clearDelayDays,
        canClearEarly:
          clearInfo.status === "pending" && (provider === "PAYFAST" || provider === "APPLE"),
        payer: {
          id: p.user?.id ?? p.userId ?? null,
          name: p.user?.name ?? null,
          email: p.user?.email ?? p.email ?? null,
        },
        payee: null,
      });
    }
  }

  const marketplaceFees = roundMoney(Number(marketplace._sum.feeAmount ?? 0));
  const marketplaceVolume = roundMoney(Number(marketplace._sum.totalAmount ?? 0));

  const marketplaceSheets: FinanceSheetRow[] = marketplaceTxs.map((tx) => {
    const total = roundMoney(Number(tx.totalAmount ?? tx.amount ?? 0));
    const fee = roundMoney(Number(tx.feeAmount ?? 0));
    const payeeAmount = roundMoney(Number(tx.amount ?? total - fee));
    return {
      id: tx.id,
      kind: "marketplace" as const,
      paidAt: tx.createdAt.toISOString(),
      provider: "MARKETPLACE",
      purpose: tx.type || "marketplace",
      purposeLabel: paymentPurposeLabel(tx.type || "marketplace"),
      gross: total,
      gatewayFee: fee,
      net: payeeAmount,
      platformShare: fee,
      creatorShare: payeeAmount,
      settlementSource: "marketplace_ledger",
      currency: "ZAR",
      fundingSource: "cash" as const,
      status: tx.status,
      fundsClearStatus: "cleared" as const,
      fundsClearLabel: "Wallet / internal",
      fundsClearDueAt: null,
      fundsClearedAt: tx.createdAt.toISOString(),
      fundsClearDaysRemaining: 0,
      fundsClearDelayDays: null,
      canClearEarly: false,
      payer: {
        id: tx.payer?.id ?? null,
        name: tx.payer?.name ?? null,
        email: tx.payer?.email ?? null,
      },
      payee: {
        id: tx.payee?.id ?? null,
        name: tx.payee?.name ?? null,
        email: tx.payee?.email ?? null,
      },
    };
  });

  const TRIAL_MS = 30 * 24 * 60 * 60 * 1000;
  const trialSheets: FinanceSheetRow[] = [];
  let trialPotentialZar = 0;
  for (const trial of activeTrials) {
    if (!trial.trialEndsAt) continue;
    const endsAt = new Date(trial.trialEndsAt);
    const startedAt = new Date(endsAt.getTime() - TRIAL_MS);
    if (startedAt > range.periodEnd || endsAt < range.periodStart) continue;
    const plan = getViewerPlanConfigById(trial.plan);
    const potential = roundMoney(plan.price);
    trialPotentialZar = roundMoney(trialPotentialZar + potential);
    const endsLabel = endsAt.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
    trialSheets.push({
      id: trial.id,
      kind: "trial",
      paidAt: startedAt.toISOString(),
      provider: "TRIAL",
      purpose: "viewer_free_trial",
      purposeLabel: `Free trial · ${plan.label} · ends ${endsLabel}`,
      gross: potential,
      gatewayFee: 0,
      net: 0,
      platformShare: 0,
      creatorShare: 0,
      settlementSource: "free_trial",
      currency: "ZAR",
      fundingSource: "trial",
      status: trial.status,
      fundsClearStatus: "not_applicable",
      fundsClearLabel: "Potential · not revenue",
      fundsClearDueAt: endsAt.toISOString(),
      fundsClearedAt: null,
      fundsClearDaysRemaining: null,
      fundsClearDelayDays: null,
      canClearEarly: false,
      payer: {
        id: trial.user?.id ?? null,
        name: trial.user?.name ?? null,
        email: trial.user?.email ?? null,
      },
      payee: null,
    });
  }

  const viewerSplit = splitViewerRevenueWithRates(viewerPoolNet, feeSettings);
  const platformTotalRetained = roundMoney(
    viewerSplit.platform + serviceRevenueNet + marketplaceFees,
  );

  const previousMonth = getPreviousCalendarMonthRange();
  const previousMonthPoolDistributed = await hasCreatorPoolDistribution(previousMonth.periodKey);

  const [promo, funding, escrowTreasury] = await Promise.all([
    fetchPromoLiability(range.periodStart, range.periodEnd, gross),
    fetchFundingMoney(range.periodStart, range.periodEnd),
    fetchEscrowAndTreasury(range.periodStart, range.periodEnd),
  ]);

  const retention: RetentionBreakdownBundle = {
    viewerPlatformRetained: viewerSplit.platform,
    marketplaceFees,
    serviceRevenueNet,
    platformTotalRetained,
    byPurpose: [...byPurposeMap.values()].sort((a, b) => b.net - a.net),
    escrow: escrowTreasury.escrow,
    treasury: escrowTreasury.treasury,
  };

  return {
    period: {
      key: range.key,
      label: range.label,
      periodStart: range.periodStart.toISOString(),
      periodEnd: range.periodEnd.toISOString(),
    },
    feeSettings: {
      appleCommissionRate: feeSettings.appleCommissionRate,
      viewerCreatorSplit: feeSettings.viewerCreatorSplit,
      viewerPlatformSplit: feeSettings.viewerPlatformSplit,
      marketplaceFeeRate: feeSettings.marketplaceFeeRate,
    },
    totals: {
      gross,
      gatewayFees,
      net,
      viewerPoolNet,
      creatorPool: viewerSplit.creator,
      platformRetained: viewerSplit.platform,
      platformServiceRevenue: serviceRevenueNet,
      platformTotalRetained,
      marketplaceFees,
      marketplaceVolume,
      paymentCount: clearedPaymentCount,
      marketplaceTxCount: marketplaceTxs.length,
      promoLiabilityZar: promo.totalDiscountZar,
      fundingSettledZar: funding.dealPayments.settledZar,
      pendingClearNet,
      pendingClearCount,
      trialPotentialZar,
      trialCount: trialSheets.length,
    },
    revenueTracking: {
      enabled: connector.creatorRevenueTrackingEnabled,
      trackingStartedAt: resolveCreatorRevenueTrackingStart(connector.trackingStartedAt).toISOString(),
      note: connector.note,
      clearRules: { payfastDays: PAYFAST_FUNDS_CLEAR_DAYS, appleDays: APPLE_FUNDS_CLEAR_DAYS },
    },
    byProvider: [...byProviderMap.entries()].map(([provider, v]) => ({ provider, ...v })),
    bySettlementSource: [...bySourceMap.entries()].map(([source, v]) => ({ source, ...v })),
    gateways: {
      payfastItnFees,
      payfastEstimatedFees,
      appleEstimatedFees,
      appleProceedsFees,
      webhookEventsInPeriod: webhookEvents,
    },
    payouts: {
      pendingCount: pendingPayouts._count?._all ?? 0,
      pendingAmount: roundMoney(pendingPayouts._sum?.amount ?? 0),
      paidCount: paidPayouts._count?._all ?? 0,
      paidAmount: roundMoney(paidPayouts._sum?.amount ?? 0),
      previousMonthPoolDistributed,
      previousMonthPeriodKey: previousMonth.periodKey,
    },
    series: [...seriesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    sheets,
    marketplaceSheets,
    trialSheets,
    promo,
    funding,
    retention,
  };
}
