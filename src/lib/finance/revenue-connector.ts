import "server-only";

import { prisma } from "@/lib/prisma";

export type RevenueConnectorSnapshot = {
  id: string | null;
  creatorRevenueTrackingEnabled: boolean;
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
    note: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

export function invalidateRevenueConnectorCache(): void {
  cached = null;
  cachedAt = 0;
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
    cached = {
      id: row.id,
      creatorRevenueTrackingEnabled: row.creatorRevenueTrackingEnabled,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
      updatedAt: row.updatedAt.toISOString(),
    };
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
}): Promise<RevenueConnectorSnapshot> {
  const existing = await prisma.platformRevenueConnector.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    creatorRevenueTrackingEnabled: Boolean(options.creatorRevenueTrackingEnabled),
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
      note: row.note,
      updatedByUserId: row.updatedByUserId,
    },
  });

  invalidateRevenueConnectorCache();
  return {
    id: row.id,
    creatorRevenueTrackingEnabled: row.creatorRevenueTrackingEnabled,
    note: row.note,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRevenueConnectorHistory(limit = 25) {
  return prisma.platformRevenueConnectorHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
}
