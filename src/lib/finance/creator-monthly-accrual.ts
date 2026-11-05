import "server-only";

import { getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { resolveCreatorRevenueTrackingStart } from "@/lib/finance/revenue-tracking-start";
import { getRevenueConnector } from "@/lib/finance/revenue-connector";
import { sumClearedViewerPoolRevenue } from "@/lib/finance/revenue-eligibility";
import { roundMoney, VIEWER_CREATOR_SPLIT } from "@/lib/payments/config";
import {
  formatRevenuePeriodKey,
  getCalendarMonthRange,
  hasCreatorPoolDistribution,
} from "@/lib/payments/creator-pool-distribution";
import { getCreatorRevenue } from "@/lib/revenue";
import { prisma } from "@/lib/prisma";

const db = prisma as unknown as {
  creatorPayout: {
    findMany: (args: unknown) => Promise<Array<{ period: string; amount: number }>>;
  };
};

export type CreatorMonthAccrualRow = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  viewerPoolNet: number;
  creatorPool: number;
  distributed: boolean;
  /** Pool still owed to creators for this month (0 if already distributed). */
  unpaidPool: number;
};

export type CreatorMonthlyAccrualBundle = {
  months: CreatorMonthAccrualRow[];
  undistributedPoolTotal: number;
  distributedPoolTotal: number;
  viewerPoolTotal: number;
};

export type CreatorMonthShareRow = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  revenue: number;
  watchTime: number;
  share: number;
  creatorPool: number;
  distributed: boolean;
  /** Credited to this creator via pool: bankReference for the month. */
  distributedAmount: number;
};

function monthCursorFrom(date: Date): { year: number; monthIndex: number } {
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

function addMonth(year: number, monthIndex: number): { year: number; monthIndex: number } {
  if (monthIndex >= 11) return { year: year + 1, monthIndex: 0 };
  return { year, monthIndex: monthIndex + 1 };
}

function listMonthKeysInclusive(from: Date, to: Date): { year: number; monthIndex: number }[] {
  const out: { year: number; monthIndex: number }[] = [];
  let cur = monthCursorFrom(from);
  const end = monthCursorFrom(to);
  for (let i = 0; i < 48; i++) {
    out.push(cur);
    if (cur.year === end.year && cur.monthIndex === end.monthIndex) break;
    cur = addMonth(cur.year, cur.monthIndex);
  }
  return out;
}

/** Platform-wide creator pool accrual by calendar month (cleared viewer cash × split). */
export async function fetchCreatorMonthlyAccruals(
  now = new Date(),
): Promise<CreatorMonthlyAccrualBundle> {
  const connector = await getRevenueConnector();
  if (!connector.creatorRevenueTrackingEnabled) {
    return {
      months: [],
      undistributedPoolTotal: 0,
      distributedPoolTotal: 0,
      viewerPoolTotal: 0,
    };
  }

  const trackingStart = resolveCreatorRevenueTrackingStart(connector.trackingStartedAt);
  const feeSettings = await getFinanceFeeSettings();
  const creatorSplit = feeSettings.viewerCreatorSplit || VIEWER_CREATOR_SPLIT;
  const monthsMeta = listMonthKeysInclusive(trackingStart, now);

  const months: CreatorMonthAccrualRow[] = [];
  for (const { year, monthIndex } of monthsMeta) {
    const { periodStart, periodEnd } = getCalendarMonthRange(year, monthIndex);
    const periodKey = formatRevenuePeriodKey(periodStart);
    const endCap = periodEnd.getTime() > now.getTime() ? now : periodEnd;
    const viewerPoolNet = await sumClearedViewerPoolRevenue(periodStart, endCap);
    const creatorPool = roundMoney(viewerPoolNet * creatorSplit);
    const distributed = await hasCreatorPoolDistribution(periodKey);
    months.push({
      periodKey,
      periodStart: periodStart.toISOString(),
      periodEnd: endCap.toISOString(),
      viewerPoolNet,
      creatorPool,
      distributed,
      unpaidPool: distributed ? 0 : creatorPool,
    });
  }

  const undistributedPoolTotal = roundMoney(
    months.reduce((sum, m) => sum + m.unpaidPool, 0),
  );
  const distributedPoolTotal = roundMoney(
    months.reduce((sum, m) => sum + (m.distributed ? m.creatorPool : 0), 0),
  );
  const viewerPoolTotal = roundMoney(months.reduce((sum, m) => sum + m.viewerPoolNet, 0));

  return {
    months: months.slice().reverse(),
    undistributedPoolTotal,
    distributedPoolTotal,
    viewerPoolTotal,
  };
}

/** Per-creator attributed share by month (estimated until pool distribution). */
export async function fetchCreatorMonthlyShares(
  creatorId: string,
  now = new Date(),
): Promise<{ months: CreatorMonthShareRow[]; attributedTotal: number; unpaidAttributedTotal: number }> {
  const connector = await getRevenueConnector();
  if (!connector.creatorRevenueTrackingEnabled) {
    return { months: [], attributedTotal: 0, unpaidAttributedTotal: 0 };
  }

  const trackingStart = resolveCreatorRevenueTrackingStart(connector.trackingStartedAt);
  const monthsMeta = listMonthKeysInclusive(trackingStart, now);
  const feeSettings = await getFinanceFeeSettings();
  const creatorSplit = feeSettings.viewerCreatorSplit || VIEWER_CREATOR_SPLIT;

  const payouts = await db.creatorPayout.findMany({
    where: {
      creatorId,
      amount: { gt: 0 },
      bankReference: { startsWith: "pool:" },
    },
    select: { period: true, amount: true },
  });
  const paidByPeriod = new Map<string, number>();
  for (const p of payouts as Array<{ period: string; amount: number }>) {
    paidByPeriod.set(p.period, roundMoney((paidByPeriod.get(p.period) ?? 0) + Number(p.amount)));
  }

  const months: CreatorMonthShareRow[] = [];
  for (const { year, monthIndex } of monthsMeta) {
    const { periodStart, periodEnd } = getCalendarMonthRange(year, monthIndex);
    const periodKey = formatRevenuePeriodKey(periodStart);
    const endCap = periodEnd.getTime() > now.getTime() ? now : periodEnd;
    const [stats, viewerPoolNet, distributed] = await Promise.all([
      getCreatorRevenue(creatorId, periodStart, endCap),
      sumClearedViewerPoolRevenue(periodStart, endCap),
      hasCreatorPoolDistribution(periodKey),
    ]);
    const creatorPool = roundMoney(viewerPoolNet * creatorSplit);
    const distributedAmount = paidByPeriod.get(periodKey) ?? 0;
    months.push({
      periodKey,
      periodStart: periodStart.toISOString(),
      periodEnd: endCap.toISOString(),
      revenue: stats.revenue,
      watchTime: stats.watchTime,
      share: stats.share,
      creatorPool,
      distributed,
      distributedAmount,
    });
  }

  const ordered = months.slice().reverse();
  const attributedTotal = roundMoney(ordered.reduce((s, m) => s + m.revenue, 0));
  const unpaidAttributedTotal = roundMoney(
    ordered.reduce((s, m) => s + (m.distributed ? 0 : m.revenue), 0),
  );

  return { months: ordered, attributedTotal, unpaidAttributedTotal };
}
