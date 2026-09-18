import "server-only";

import { prisma } from "@/lib/prisma";
import { startOfDayInJohannesburg } from "@/lib/finance/revenue-eligibility";

export type RevenueConnectorSnapshot = {
  id: string | null;
  creatorRevenueTrackingEnabled: boolean;
  trackingStartedAt: string | null;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

const CACHE_TTL_MS = 15_000;
let cachedAt = 0;
let cached: RevenueConnectorSnapshot | null = null;

export function defaultRevenueConnector(): RevenueConnectorSnapshot {
  return {
    id: null,
    // Default paused until an admin explicitly enables creator revenue visibility.
    creatorRevenueTrackingEnabled: false,
    trackingStartedAt: null,
    note: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

export function invalidateRevenueConnectorCache(): void {
  cached = null;
  cachedAt = 0;
}

function toSnapshot(row: {
  id: string;
  creatorRevenueTrackingEnabled: boolean;
  trackingStartedAt: Date | null;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
}): RevenueConnectorSnapshot {
  return {
    id: row.id,
    creatorRevenueTrackingEnabled: row.creatorRevenueTrackingEnabled,
    trackingStartedAt: row.trackingStartedAt ? row.trackingStartedAt.toISOString() : null,
    note: row.note,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getRevenueConnector(): Promise<RevenueConnectorSnapshot> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const row = await prisma.platformRevenueConnector.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      cached = defaultRevenueConnector();
      cachedAt = Date.now();
      return cached;
    }
    cached = toSnapshot(row as typeof row & { trackingStartedAt: Date | null });
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    console.warn("[revenue-connector] read failed; defaulting to paused", err);
    return defaultRevenueConnector();
  }
}

/** True when creators may see and accrue attributed earnings. */
export async function isCreatorRevenueTrackingEnabled(): Promise<boolean> {
  const snap = await getRevenueConnector();
  return snap.creatorRevenueTrackingEnabled === true;
}

export async function upsertRevenueConnector(options: {
  creatorRevenueTrackingEnabled: boolean;
  note?: string | null;
  updatedByUserId?: string | null;
  /** When enabling, defaults to start of today (Africa/Johannesburg) if not already set. */
  trackingStartedAt?: Date | null;
}): Promise<RevenueConnectorSnapshot> {
  const existing = await prisma.platformRevenueConnector.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  let trackingStartedAt: Date | null | undefined = options.trackingStartedAt;
  if (options.creatorRevenueTrackingEnabled) {
    if (trackingStartedAt === undefined) {
      trackingStartedAt =
        (existing as { trackingStartedAt?: Date | null } | null)?.trackingStartedAt ??
        startOfDayInJohannesburg();
    }
  } else if (trackingStartedAt === undefined) {
    trackingStartedAt = (existing as { trackingStartedAt?: Date | null } | null)?.trackingStartedAt ?? null;
  }

  const data = {
    creatorRevenueTrackingEnabled: Boolean(options.creatorRevenueTrackingEnabled),
    trackingStartedAt: trackingStartedAt ?? null,
    note: options.note?.trim() || null,
    updatedByUserId: options.updatedByUserId ?? null,
  };

  const row = existing
    ? await prisma.platformRevenueConnector.update({ where: { id: existing.id }, data })
    : await prisma.platformRevenueConnector.create({ data });

  await prisma.platformRevenueConnectorHistory.create({
    data: {
      settingsId: row.id,
      creatorRevenueTrackingEnabled: row.creatorRevenueTrackingEnabled,
      trackingStartedAt: (row as { trackingStartedAt?: Date | null }).trackingStartedAt ?? null,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
    },
  });

  invalidateRevenueConnectorCache();
  return toSnapshot(row as typeof row & { trackingStartedAt: Date | null });
}

export async function listRevenueConnectorHistory(limit = 25) {
  return prisma.platformRevenueConnectorHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
}

/**
 * Ensure creator revenue tracking is ON from start of today (Johannesburg).
 * Idempotent — does not move trackingStartedAt if already set.
 */
export async function ensureCreatorRevenueTrackingLive(options?: {
  note?: string;
  updatedByUserId?: string | null;
}): Promise<RevenueConnectorSnapshot> {
  const current = await getRevenueConnector();
  if (current.creatorRevenueTrackingEnabled && current.trackingStartedAt) {
    return current;
  }
  return upsertRevenueConnector({
    creatorRevenueTrackingEnabled: true,
    trackingStartedAt: current.trackingStartedAt
      ? new Date(current.trackingStartedAt)
      : startOfDayInJohannesburg(),
    note:
      options?.note ??
      "Creator revenue recording live — new subscribers count after PayFast/Apple clear; existing subs count on next renewal.",
    updatedByUserId: options?.updatedByUserId ?? null,
  });
}
