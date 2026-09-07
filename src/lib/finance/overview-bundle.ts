import "server-only";

import { prisma } from "@/lib/prisma";
import { getCashSettlementAmount, isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { splitViewerRevenueWithRates } from "@/lib/finance/fee-math";
import { resolveFinancePeriodRange, type FinancePeriodKey } from "@/lib/finance/period-range";
import { aggregateCompletedMarketplaceFees } from "@/lib/financial-ledger";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";
import { roundMoney } from "@/lib/payments/config";
import {
  hasCreatorPoolDistribution,
  getPreviousCalendarMonthRange,
} from "@/lib/payments/creator-pool-distribution";

const db = prisma as any;

export type FinanceSheetRow = {
  id: string;
  paidAt: string | null;
  provider: string;
  purpose: string;
  gross: number;
  gatewayFee: number;
  net: number;
  platformShare: number;
  creatorShare: number;
  settlementSource: string | null;
  currency: string;
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
    marketplaceFees: number;
    marketplaceVolume: number;
    paymentCount: number;
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
  const range = resolveFinancePeriodRange({
    period: options.period,
    from: options.from,
    to: options.to,
  });
  const feeSettings = await getFinanceFeeSettings();
  const sheetLimit = Math.min(500, Math.max(50, options.sheetLimit ?? 200));

  const [payments, marketplace, webhookEvents, pendingPayouts, paidPayouts] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        status: "SUCCEEDED",
        paidAt: { gte: range.periodStart, lte: range.periodEnd },
        amount: { gt: 0 },
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
  ]);

  const cashPayments = payments.filter((p) => isCashRecognizedPayment(p));

  let gross = 0;
  let gatewayFees = 0;
  let net = 0;
  let viewerPoolNet = 0;
  let payfastItnFees = 0;
  let payfastEstimatedFees = 0;
  let appleEstimatedFees = 0;
  let appleProceedsFees = 0;

  const byProviderMap = new Map<string, { count: number; gross: number; fees: number; net: number }>();
  const bySourceMap = new Map<string, { count: number; fees: number; net: number }>();
  const seriesMap = new Map<string, { gross: number; fees: number; net: number }>();

  const sheets: FinanceSheetRow[] = [];

  for (const p of cashPayments) {
    const g = roundMoney(Number(p.amount) || 0);
    const settlement = getCashSettlementAmount(p);
    const fee =
      p.providerFeeAmount != null && Number.isFinite(Number(p.providerFeeAmount))
        ? roundMoney(Number(p.providerFeeAmount))
        : roundMoney(Math.max(0, g - settlement));

    gross = roundMoney(gross + g);
    gatewayFees = roundMoney(gatewayFees + fee);
    net = roundMoney(net + settlement);

    if (isViewerPoolPaymentPurpose(p.purpose)) {
      viewerPoolNet = roundMoney(viewerPoolNet + settlement);
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

    if (sheets.length < sheetLimit) {
      const split = splitViewerRevenueWithRates(settlement, feeSettings);
      const isViewerPool = isViewerPoolPaymentPurpose(p.purpose);
      sheets.push({
        id: p.id,
        paidAt: p.paidAt?.toISOString() ?? null,
        provider,
        purpose: p.purpose,
        gross: g,
        gatewayFee: fee,
        net: settlement,
        platformShare: isViewerPool ? split.platform : settlement,
        creatorShare: isViewerPool ? split.creator : 0,
        settlementSource: p.settlementSource,
        currency: p.currency || "ZAR",
      });
    }
  }

  const viewerSplit = splitViewerRevenueWithRates(viewerPoolNet, feeSettings);
  const previousMonth = getPreviousCalendarMonthRange();
  const previousMonthPoolDistributed = await hasCreatorPoolDistribution(previousMonth.periodKey);

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
      marketplaceFees: roundMoney(Number(marketplace._sum.feeAmount ?? 0)),
      marketplaceVolume: roundMoney(Number(marketplace._sum.totalAmount ?? 0)),
      paymentCount: cashPayments.length,
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
  };
}
