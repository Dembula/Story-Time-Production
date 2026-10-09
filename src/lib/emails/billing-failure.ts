import "server-only";

import { prisma } from "@/lib/prisma";
import { sendBillingFailureEmail } from "@/lib/sendgrid";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";

const db = prisma as any;

/** Prefix only — full key is period-scoped so next month can email again. */
export const BILLING_FAILURE_CAMPAIGN_PREFIX = "billing_failure";

export function billingFailureCampaignKey(args: {
  subscriptionId: string;
  /** Anchor for this dunning/period cycle (usually pastDueSince or now on first fail). */
  periodAnchor: Date;
}): string {
  const day = args.periodAnchor.toISOString().slice(0, 10);
  return `${BILLING_FAILURE_CAMPAIGN_PREFIX}:${args.subscriptionId}:${day}`;
}

function billingAccountUrl(): string {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  return `${base}/browse/account`;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Send billing-failure template once per subscription dunning period.
 * Safe to call on every failed charge — retries in the same past-due cycle no-op.
 */
export async function sendBillingFailureOnce(args: {
  userId?: string | null;
  email: string;
  name?: string | null;
  subscriptionId: string;
  /** Existing pastDueSince before this failure, or null on first fail of the period. */
  pastDueSince?: Date | null;
  errorMessage?: string | null;
  /** When true, skip EmailCampaignDelivery gate (admin test only). */
  force?: boolean;
  dryRun?: boolean;
  now?: Date;
}): Promise<{ sent: boolean; skipped?: string; campaignKey: string }> {
  const email = args.email.trim().toLowerCase();
  const now = args.now ?? new Date();
  const periodAnchor = args.pastDueSince ?? now;
  const campaignKey = billingFailureCampaignKey({
    subscriptionId: args.subscriptionId,
    periodAnchor,
  });

  if (!email || !looksLikeEmail(email)) {
    return { sent: false, skipped: "invalid_email", campaignKey };
  }

  if (!args.force) {
    const existing = await db.emailCampaignDelivery.findUnique({
      where: {
        email_campaignKey: { email, campaignKey },
      },
      select: { id: true },
    });
    if (existing) return { sent: false, skipped: "already_sent_this_period", campaignKey };
  }

  if (args.dryRun) return { sent: false, skipped: "dry_run", campaignKey };

  await sendBillingFailureEmail(email, {
    name: args.name,
    billingUrl: billingAccountUrl(),
    errorMessage: args.errorMessage,
  });

  await db.emailCampaignDelivery.upsert({
    where: {
      email_campaignKey: { email, campaignKey },
    },
    create: {
      userId: args.userId ?? null,
      email,
      campaignKey,
      metadata: {
        subscriptionId: args.subscriptionId,
        periodAnchor: periodAnchor.toISOString(),
        force: Boolean(args.force),
      },
    },
    update: {
      sentAt: new Date(),
      userId: args.userId ?? undefined,
      metadata: {
        subscriptionId: args.subscriptionId,
        periodAnchor: periodAnchor.toISOString(),
        force: Boolean(args.force),
      },
    },
  });

  return { sent: true, campaignKey };
}

export type FailedBillingCandidate = {
  userId: string;
  email: string;
  name: string | null;
  subscriptionId: string;
  pastDueSince: Date | null;
  lastPaymentError: string | null;
  lastPaymentStatus: string | null;
  renewalAttemptCount: number;
};

/** Viewers currently PAST_DUE after a failed (non-pending) renewal attempt. */
export async function listFailedViewerBillingCandidates(options?: {
  take?: number;
}): Promise<FailedBillingCandidate[]> {
  const take = Math.min(2000, Math.max(1, options?.take ?? 500));
  const rows = await db.viewerSubscription.findMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      status: "PAST_DUE",
      lastPaymentStatus: { in: ["FAILED", "ERROR", "DECLINED"] },
      user: { email: { not: null } },
    },
    select: {
      id: true,
      pastDueSince: true,
      lastPaymentError: true,
      lastPaymentStatus: true,
      renewalAttemptCount: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { pastDueSince: "asc" },
    take,
  });

  return rows
    .map((row: (typeof rows)[number]) => ({
      userId: row.user.id as string,
      email: String(row.user.email ?? "")
        .trim()
        .toLowerCase(),
      name: (row.user.name as string | null) ?? null,
      subscriptionId: row.id as string,
      pastDueSince: (row.pastDueSince as Date | null) ?? null,
      lastPaymentError: (row.lastPaymentError as string | null) ?? null,
      lastPaymentStatus: (row.lastPaymentStatus as string | null) ?? null,
      renewalAttemptCount: Number(row.renewalAttemptCount ?? 0),
    }))
    .filter((row: FailedBillingCandidate) => looksLikeEmail(row.email));
}

export async function filterAlreadySentBillingFailure(
  candidates: FailedBillingCandidate[],
  now = new Date(),
): Promise<FailedBillingCandidate[]> {
  if (candidates.length === 0) return [];
  const keys = candidates.map((c) =>
    billingFailureCampaignKey({
      subscriptionId: c.subscriptionId,
      periodAnchor: c.pastDueSince ?? now,
    }),
  );
  const emails = candidates.map((c) => c.email);
  const sent = await db.emailCampaignDelivery.findMany({
    where: {
      email: { in: emails },
      campaignKey: { in: keys },
    },
    select: { email: true, campaignKey: true },
  });
  const sentSet = new Set(
    sent.map((r: { email: string; campaignKey: string }) => `${r.email.toLowerCase()}|${r.campaignKey}`),
  );
  return candidates.filter((c) => {
    const key = billingFailureCampaignKey({
      subscriptionId: c.subscriptionId,
      periodAnchor: c.pastDueSince ?? now,
    });
    return !sentSet.has(`${c.email}|${key}`);
  });
}

export async function countFailedBillingNeedingEmail(): Promise<{
  failed: number;
  alreadySentThisPeriod: number;
  remaining: number;
}> {
  const candidates = await listFailedViewerBillingCandidates({ take: 2000 });
  const remaining = await filterAlreadySentBillingFailure(candidates);
  return {
    failed: candidates.length,
    alreadySentThisPeriod: candidates.length - remaining.length,
    remaining: remaining.length,
  };
}
