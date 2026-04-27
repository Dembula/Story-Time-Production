/**
 * Central place for **marketplace settlement** money: `Transaction` rows, typed payouts,
 * and shared helpers so dashboards and admin use the same rules.
 *
 * Other domains (still authoritative, imported where needed):
 * - Creator watch-time pool: `./revenue` (`getCreatorRevenue`, `getViewerSubscriptionRevenue`, `getPlatformStats`)
 * - Music sync licensing: `SyncDeal` / `SyncRequest` — `getMusicCreatorSyncStatsPayload` (per-creator workspace);
 *   admin rollups use `aggregateSyncDealsByCreator` (MTD, PAID deals only).
 * - Equipment / crew / casting marketplace: `Transaction` + `SIMULATED_PAYMENT_PURPOSE` (pay routes mirror catering/location).
 * - Company & distribution licences: `PaymentRecord` with purposes in `ADMIN_PAYMENT_PURPOSE`
 *
 * **Reporting windows**
 * - **Admin revenue** (`/api/admin/revenue`): single **calendar month-to-date** window in server local time
 *   (`getCalendarMonthToDateRange`), including sync deals (`SyncDeal.createdAt`, status PAID).
 * - **Marketplace payee dashboards** (catering, location settled totals, equipment, crew, casting):
 *   **all-time** sums of `COMPLETED` `Transaction` rows for that payee + `type` (see `MARKETPLACE_PAYEE_SETTLED_REPORTING`).
 * - **Music creator dashboard**: all-time per creator via `getMusicCreatorSyncStatsPayload`.
 *
 * **Simulated pay idempotency:** parent rows (`LocationBooking`, `CateringBooking`, `EquipmentRequest`,
 * `CrewTeamRequest`, `CastingInquiry`, …) store `paymentTransactionId`. Pay POST handlers must reject
 * with “Already paid” when that field is set. `Transaction.status === COMPLETED` is the settlement signal.
 */
import { prisma } from "./prisma";
export { computeEquipmentRequestBaseZar } from "./equipment-request-base-zar";
export {
  computeMarketplaceFeeZar,
  DEFAULT_CASTING_INQUIRY_BASE_ZAR,
  DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR,
} from "./marketplace-zar-defaults";

/** Re-export creator pool primitives so callers can import marketplace + pool logic from one module. */
export { getCreatorRevenue, getViewerSubscriptionRevenue, getPlatformStats } from "./revenue";

/** Values stored on `Transaction.type` (see Prisma schema). */
export const MARKETPLACE_TRANSACTION_TYPE = {
  LOCATION_BOOKING: "LOCATION_BOOKING",
  CATERING_BOOKING: "CATERING_BOOKING",
  EQUIPMENT_REQUEST: "EQUIPMENT_REQUEST",
  CREW_REQUEST: "CREW_REQUEST",
  CAST_INQUIRY: "CAST_INQUIRY",
} as const;

export type MarketplaceTransactionType =
  (typeof MARKETPLACE_TRANSACTION_TYPE)[keyof typeof MARKETPLACE_TRANSACTION_TYPE];

/** Purposes written to `PaymentRecord.purpose` for simulated gateway flows. */
export const SIMULATED_PAYMENT_PURPOSE = {
  CATERING_BOOKING: "CATERING_BOOKING",
  LOCATION_BOOKING: "LOCATION_BOOKING",
  EQUIPMENT_REQUEST: "EQUIPMENT_REQUEST",
  CREW_REQUEST: "CREW_REQUEST",
  CAST_INQUIRY: "CAST_INQUIRY",
} as const;

/** Admin revenue: `PaymentRecord.purpose` filters (company + creator licence SKUs). */
export const ADMIN_PAYMENT_PURPOSE = {
  COMPANY_SUBSCRIPTION: "COMPANY_SUBSCRIPTION",
  COMPANY_SUBSCRIPTION_RENEWAL: "COMPANY_SUBSCRIPTION_RENEWAL",
  CREATOR_YEARLY_LICENSE: "CREATOR_YEARLY_LICENSE",
  CREATOR_CONTENT_UPLOAD: "CREATOR_CONTENT_UPLOAD",
  CREATOR_MUSIC_UPLOAD: "CREATOR_MUSIC_UPLOAD",
} as const;

const TX_STATUS_COMPLETED = "COMPLETED";

/** Sync deals counted toward admin MTD revenue (matches music dashboard “paid” placements). */
export const SYNC_DEAL_STATUS_PAID = "PAID" as const;

/** First instant of the current calendar month through `now` (server local timezone). */
export function getCalendarMonthToDateRange(now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { periodStart, periodEnd: now };
}

/** Attached to JSON for marketplace payee stats routes (catering, equipment, crew, casting). */
export const MARKETPLACE_PAYEE_SETTLED_REPORTING = {
  settledWindow: "all_time_completed_transactions" as const,
  note: "Revenue is the sum of completed marketplace transactions for this payee (no calendar period filter).",
} as const;

/** Creator stats that call `getCreatorRevenue` for the current month window. */
export const CREATOR_WATCH_POOL_REPORTING = {
  poolWindow: "calendar_month_to_date" as const,
  note: "Watch-time pool figures from `getCreatorRevenue(periodStart, periodEnd)` for the current calendar month.",
} as const;

export type ListCompletedTxOpts = { take?: number; skip?: number };

const DEFAULT_TX_LIST_TAKE = 50;
const MAX_TX_LIST_TAKE = 100;

export async function sumPayeeCompletedAmount(payeeId: string, type: MarketplaceTransactionType): Promise<number> {
  const row = await prisma.transaction.aggregate({
    where: { payeeId, type, status: TX_STATUS_COMPLETED },
    _sum: { amount: true },
  });
  return row._sum.amount ?? 0;
}

export async function listPayeeCompletedTransactions(
  payeeId: string,
  type: MarketplaceTransactionType,
  takeOrOpts: number | ListCompletedTxOpts = DEFAULT_TX_LIST_TAKE,
): Promise<{ id: string; amount: number; totalAmount: number; createdAt: Date }[]> {
  let take = DEFAULT_TX_LIST_TAKE;
  let skip = 0;
  if (typeof takeOrOpts === "number") {
    take = Math.min(MAX_TX_LIST_TAKE, Math.max(1, takeOrOpts));
  } else if (takeOrOpts) {
    take = Math.min(MAX_TX_LIST_TAKE, Math.max(1, takeOrOpts.take ?? DEFAULT_TX_LIST_TAKE));
    skip = Math.max(0, takeOrOpts.skip ?? 0);
  }
  return prisma.transaction.findMany({
    where: { payeeId, type, status: TX_STATUS_COMPLETED },
    orderBy: { createdAt: "desc" },
    take,
    skip,
    select: { id: true, amount: true, totalAmount: true, createdAt: true },
  });
}

const EXPORT_TX_CAP = 5000;

/** CSV exports — larger cap than interactive lists; same COMPLETED filter. */
export async function listPayeeCompletedTransactionsForExport(
  payeeId: string,
  type: MarketplaceTransactionType,
  cap = EXPORT_TX_CAP,
): Promise<{ id: string; amount: number; totalAmount: number; createdAt: Date }[]> {
  return prisma.transaction.findMany({
    where: { payeeId, type, status: TX_STATUS_COMPLETED },
    orderBy: { createdAt: "desc" },
    take: Math.min(cap, EXPORT_TX_CAP),
    select: { id: true, amount: true, totalAmount: true, createdAt: true },
  });
}

/** Platform-wide completed marketplace fees (3% etc.) in a window — used by admin revenue. */
export async function aggregateCompletedMarketplaceFees(periodStart: Date, periodEnd: Date) {
  return prisma.transaction.aggregate({
    where: { status: TX_STATUS_COMPLETED, createdAt: { gte: periodStart, lte: periodEnd } },
    _sum: { feeAmount: true, totalAmount: true },
  });
}

/**
 * Sync deal amounts grouped by music creator for **admin** revenue (MTD, PAID deals only).
 * For a single creator’s full workspace, use `getMusicCreatorSyncStatsPayload`.
 */
export async function aggregateSyncDealsByCreator(period: { start: Date; end: Date }) {
  const syncDeals = await prisma.syncDeal.findMany({
    where: {
      status: SYNC_DEAL_STATUS_PAID,
      createdAt: { gte: period.start, lte: period.end },
    },
    select: { amount: true, musicTrack: { select: { creatorId: true } } },
  });
  const syncByCreator: Record<string, number> = {};
  let totalSyncRevenue = 0;
  for (const d of syncDeals) {
    syncByCreator[d.musicTrack.creatorId] = (syncByCreator[d.musicTrack.creatorId] || 0) + d.amount;
    totalSyncRevenue += d.amount;
  }
  return { syncByCreator, totalSyncRevenue, totalDeals: syncDeals.length };
}

/** Payload shape returned by `GET /api/music/stats` (music-creator dashboard + revenue UI). */
export type MusicCreatorSyncStatsPayload = {
  totalTracks: number;
  totalSyncEarnings: number;
  totalPlacements: number;
  paidDeals: number;
  pendingRequests: number;
  approvedRequests: number;
  totalRequests: number;
  genres: string[];
  earningsByTrack: {
    id: string;
    title: string;
    genre: string | null;
    earnings: number;
    placements: number;
    requests: number;
    pendingRequests: number;
  }[];
  earningsByFilm: { track: string; film: string; filmType: string; amount: number; status: string }[];
  potentialRevenue: number;
};

/**
 * Full sync workspace for one music creator: tracks, deals, requests, rollups.
 * Single source for music ZAR sync metrics (dashboard + `/music-creator/revenue`).
 * For admin-wide MTD totals by creator, use `aggregateSyncDealsByCreator({ start, end })` (lighter query shape).
 */
export async function getMusicCreatorSyncStatsPayload(musicCreatorUserId: string): Promise<MusicCreatorSyncStatsPayload> {
  const tracks = await prisma.musicTrack.findMany({
    where: { creatorId: musicCreatorUserId },
    include: {
      syncDeals: { include: { content: { select: { title: true, type: true } } } },
      syncRequests: {
        include: {
          requester: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
        },
      },
    },
  });

  const totalTracks = tracks.length;
  const totalSyncEarnings = tracks.reduce((s, t) => s + t.syncDeals.reduce((ss, d) => ss + d.amount, 0), 0);
  const totalPlacements = tracks.reduce((s, t) => s + t.syncDeals.length, 0);
  const paidDeals = tracks.reduce((s, t) => s + t.syncDeals.filter((d) => d.status === "PAID").length, 0);
  const pendingRequests = tracks.reduce((s, t) => s + t.syncRequests.filter((r) => r.status === "PENDING").length, 0);
  const approvedRequests = tracks.reduce((s, t) => s + t.syncRequests.filter((r) => r.status === "APPROVED").length, 0);
  const totalRequests = tracks.reduce((s, t) => s + t.syncRequests.length, 0);
  const genres = [...new Set(tracks.map((t) => t.genre).filter(Boolean))] as string[];

  const earningsByTrack = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    genre: t.genre,
    earnings: t.syncDeals.reduce((s, d) => s + d.amount, 0),
    placements: t.syncDeals.length,
    requests: t.syncRequests.length,
    pendingRequests: t.syncRequests.filter((r) => r.status === "PENDING").length,
  }));

  const earningsByFilm = tracks.flatMap((t) =>
    t.syncDeals.map((d) => ({
      track: t.title,
      film: d.content.title,
      filmType: d.content.type,
      amount: d.amount,
      status: d.status,
    })),
  );

  const potentialRevenue = tracks.reduce(
    (s, t) => s + t.syncRequests.filter((r) => r.status === "PENDING").reduce((ss, r) => ss + (r.budget || 0), 0),
    0,
  );

  return {
    totalTracks,
    totalSyncEarnings,
    totalPlacements,
    paidDeals,
    pendingRequests,
    approvedRequests,
    totalRequests,
    genres,
    earningsByTrack,
    earningsByFilm,
    potentialRevenue,
  };
}

export function computeLocationBookingBaseZar(input: {
  dailyRate: number | null | undefined;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
}): number {
  const rate = input.dailyRate ?? 0;
  if (input.startDate && input.endDate && rate > 0) {
    const start = new Date(input.startDate).getTime();
    const end = new Date(input.endDate).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      return Math.round(days * rate * 100) / 100;
    }
  }
  return rate > 0 ? Math.round(rate * 100) / 100 : 500;
}

/** How marketplace “settled” figures are computed for location/catering owner views. */
export type MarketplaceSettledReportingMeta = {
  settledWindow: "all_time_completed_transactions";
  pipelineWindow: "current_approved_bookings_without_payment";
};

export type LocationOwnerFinancialSnapshot = {
  settledRevenue: number;
  pipelineEstimate: number;
  settledTransactionCount: number;
  approvedAwaitingPaymentCount: number;
  recentSettlements: { id: string; amount: number; createdAt: string; referenceId: string }[];
  reporting: MarketplaceSettledReportingMeta;
};

/** Admin `/api/admin/revenue`: all monetary lines use `primaryWindow` except noted cumulative counts. */
export type AdminRevenueReportingMeta = {
  primaryWindow: { label: string; periodStartIso: string; periodEndIso: string };
  lines: {
    monthToDate: string[];
    /** Reserved; kept empty so older clients expecting the field do not break. */
    allTime: string[];
    cumulativeCounts: string[];
  };
};

export async function getLocationOwnerFinancialSnapshot(ownerUserId: string): Promise<LocationOwnerFinancialSnapshot> {
  const [settledAgg, settledList, approvedBookings] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        payeeId: ownerUserId,
        type: MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING,
        status: TX_STATUS_COMPLETED,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.findMany({
      where: {
        payeeId: ownerUserId,
        type: MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING,
        status: TX_STATUS_COMPLETED,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, amount: true, createdAt: true, referenceId: true },
    }),
    prisma.locationBooking.findMany({
      where: { ownerId: ownerUserId, status: "APPROVED" },
      select: {
        paymentTransactionId: true,
        startDate: true,
        endDate: true,
        location: { select: { dailyRate: true } },
      },
    }),
  ]);

  let pipelineEstimate = 0;
  let approvedAwaitingPaymentCount = 0;
  for (const b of approvedBookings) {
    if (b.paymentTransactionId) continue;
    approvedAwaitingPaymentCount += 1;
    pipelineEstimate += computeLocationBookingBaseZar({
      dailyRate: b.location.dailyRate,
      startDate: b.startDate,
      endDate: b.endDate,
    });
  }

  return {
    settledRevenue: settledAgg._sum.amount ?? 0,
    pipelineEstimate: Math.round(pipelineEstimate * 100) / 100,
    settledTransactionCount: settledAgg._count._all,
    approvedAwaitingPaymentCount,
    recentSettlements: settledList.map((t) => ({
      id: t.id,
      amount: t.amount,
      createdAt: t.createdAt.toISOString(),
      referenceId: t.referenceId,
    })),
    reporting: {
      settledWindow: "all_time_completed_transactions",
      pipelineWindow: "current_approved_bookings_without_payment",
    },
  };
}

export function buildAdminRevenueReportingMeta(periodStart: Date, periodEnd: Date): AdminRevenueReportingMeta {
  return {
    primaryWindow: {
      label: "Calendar month to date (server local timezone)",
      periodStartIso: periodStart.toISOString(),
      periodEndIso: periodEnd.toISOString(),
    },
    lines: {
      monthToDate: [
        "Viewer subscription revenue and 60/40 split",
        "Marketplace transaction fees (completed tx in window)",
        "Company subscription payments",
        "Creator yearly and per-upload licence payments",
        "Per-creator watch pool payout (`getCreatorRevenue`)",
        "Per-title watch allocation and platform pool display",
        "Watch sessions attributed to content",
        "Sync licensing — PAID `SyncDeal` rows with `createdAt` in this window",
      ],
      allTime: [],
      cumulativeCounts: [
        "Platform `totalUsers` and `totalContent` from `getPlatformStats` (not restricted to the month window)",
      ],
    },
  };
}
