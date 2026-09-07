import "server-only";

import { prisma } from "@/lib/prisma";
import {
  applyAppleCommission,
  defaultFinanceFeeRates,
  validateFinanceFeeRates,
  type FinanceFeeRates,
} from "@/lib/finance/fee-math";

export type FinanceFeeSettingsSnapshot = FinanceFeeRates & {
  id: string | null;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

const CACHE_TTL_MS = 30_000;
let cachedAt = 0;
let cached: FinanceFeeSettingsSnapshot | null = null;

export { applyAppleCommission, validateFinanceFeeRates };

export function defaultFinanceFeeSettings(): FinanceFeeSettingsSnapshot {
  return {
    ...defaultFinanceFeeRates(),
    id: null,
    note: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

export function invalidateFinanceFeeSettingsCache(): void {
  cached = null;
  cachedAt = 0;
}

export function validateFinanceFeeSettingsInput(input: Partial<FinanceFeeRates>) {
  return validateFinanceFeeRates(input);
}

export async function getFinanceFeeSettings(): Promise<FinanceFeeSettingsSnapshot> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const row = await prisma.financeFeeSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      cached = defaultFinanceFeeSettings();
      cachedAt = Date.now();
      return cached;
    }
    cached = {
      id: row.id,
      appleCommissionRate: row.appleCommissionRate,
      viewerCreatorSplit: row.viewerCreatorSplit,
      viewerPlatformSplit: row.viewerPlatformSplit,
      marketplaceFeeRate: row.marketplaceFeeRate,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
      updatedAt: row.updatedAt.toISOString(),
    };
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    console.warn("[finance-fee-settings] read failed; using defaults", err);
    return defaultFinanceFeeSettings();
  }
}

export async function upsertFinanceFeeSettings(options: FinanceFeeRates & {
  note?: string | null;
  updatedByUserId?: string | null;
}): Promise<FinanceFeeSettingsSnapshot> {
  const validated = validateFinanceFeeRates(options);
  if (!validated.ok) throw new Error(validated.error);

  const existing = await prisma.financeFeeSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    appleCommissionRate: validated.values.appleCommissionRate,
    viewerCreatorSplit: validated.values.viewerCreatorSplit,
    viewerPlatformSplit: validated.values.viewerPlatformSplit,
    marketplaceFeeRate: validated.values.marketplaceFeeRate,
    note: options.note?.trim() || null,
    updatedByUserId: options.updatedByUserId ?? null,
  };

  const row = existing
    ? await prisma.financeFeeSettings.update({ where: { id: existing.id }, data })
    : await prisma.financeFeeSettings.create({ data });

  await prisma.financeFeeSettingsHistory.create({
    data: {
      settingsId: row.id,
      appleCommissionRate: row.appleCommissionRate,
      viewerCreatorSplit: row.viewerCreatorSplit,
      viewerPlatformSplit: row.viewerPlatformSplit,
      marketplaceFeeRate: row.marketplaceFeeRate,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
    },
  });

  invalidateFinanceFeeSettingsCache();
  return {
    id: row.id,
    appleCommissionRate: row.appleCommissionRate,
    viewerCreatorSplit: row.viewerCreatorSplit,
    viewerPlatformSplit: row.viewerPlatformSplit,
    marketplaceFeeRate: row.marketplaceFeeRate,
    note: row.note,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFinanceFeeSettingsHistory(limit = 25) {
  return prisma.financeFeeSettingsHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
}
