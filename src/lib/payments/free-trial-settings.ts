import "server-only";

import { prisma } from "@/lib/prisma";
import type { StoreFreeTrialInfo } from "@/lib/payments/store-trial";

export type FreeTrialSettingsSnapshot = {
  id: string | null;
  freeTrialsEnabled: boolean;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: string | null;
};

const CACHE_TTL_MS = 15_000;
let cachedAt = 0;
let cached: FreeTrialSettingsSnapshot | null = null;

/** Default OFF — no new free trials until an admin enables them. */
export function defaultFreeTrialSettings(): FreeTrialSettingsSnapshot {
  return {
    id: null,
    freeTrialsEnabled: false,
    note: null,
    updatedByUserId: null,
    updatedAt: null,
  };
}

export function invalidateFreeTrialSettingsCache(): void {
  cached = null;
  cachedAt = 0;
}

function toSnapshot(row: {
  id: string;
  freeTrialsEnabled: boolean;
  note: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
}): FreeTrialSettingsSnapshot {
  return {
    id: row.id,
    freeTrialsEnabled: row.freeTrialsEnabled === true,
    note: row.note,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getFreeTrialSettings(): Promise<FreeTrialSettingsSnapshot> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const row = await prisma.platformFreeTrialSettings.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      cached = defaultFreeTrialSettings();
      cachedAt = Date.now();
      return cached;
    }
    cached = toSnapshot(row);
    cachedAt = Date.now();
    return cached;
  } catch (err) {
    console.warn("[free-trial-settings] read failed; defaulting to disabled", err);
    return defaultFreeTrialSettings();
  }
}

/** True when new free trials may be offered (viewer + creator). */
export async function isFreeTrialsEnabled(): Promise<boolean> {
  const snap = await getFreeTrialSettings();
  return snap.freeTrialsEnabled === true;
}

/** When platform trials are off, do not grant new store/IAP intro trials (web PayFast pending flows may continue). */
export async function gateStoreFreeTrialForPlatform(
  trial: StoreFreeTrialInfo,
  options?: { continuingPending?: boolean },
): Promise<StoreFreeTrialInfo> {
  if (!trial.isFreeTrial) return trial;
  if (options?.continuingPending) return trial;
  if (await isFreeTrialsEnabled()) return trial;
  return { isFreeTrial: false, trialEndsAt: null, source: "none" };
}

export async function upsertFreeTrialSettings(options: {
  freeTrialsEnabled: boolean;
  note?: string | null;
  updatedByUserId?: string | null;
}): Promise<FreeTrialSettingsSnapshot> {
  const existing = await prisma.platformFreeTrialSettings.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    freeTrialsEnabled: options.freeTrialsEnabled === true,
    note: options.note?.trim() || null,
    updatedByUserId: options.updatedByUserId ?? null,
  };

  const row = existing
    ? await prisma.platformFreeTrialSettings.update({ where: { id: existing.id }, data })
    : await prisma.platformFreeTrialSettings.create({ data });

  await prisma.platformFreeTrialSettingsHistory.create({
    data: {
      settingsId: row.id,
      freeTrialsEnabled: row.freeTrialsEnabled,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
    },
  });

  invalidateFreeTrialSettingsCache();
  return toSnapshot(row);
}

export async function listFreeTrialSettingsHistory(limit = 20) {
  try {
    return await prisma.platformFreeTrialSettingsHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
  } catch {
    return [];
  }
}
