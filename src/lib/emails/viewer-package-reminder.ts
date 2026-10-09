import "server-only";

import { prisma } from "@/lib/prisma";
import { sendViewerPackageReminderEmail } from "@/lib/sendgrid";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";

const db = prisma as any;

export const VIEWER_PACKAGE_REMINDER_CAMPAIGN = "viewer_package_reminder";

const ENGAGED_SUB_STATUSES = ["ACTIVE", "TRIAL_ACTIVE", "TRIAL_CARD_PENDING", "PAST_DUE"] as const;

export type ViewerPackageReminderCandidate = {
  userId: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

function packageOnboardingUrl(): string {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  return `${base}/onboarding/package`;
}

/** Viewers with no engaged catalogue subscription and an email address. */
export async function listInactiveViewerPackageCandidates(options?: {
  /** Only accounts created in this window (for day-2 cron). */
  createdAtGte?: Date;
  createdAtLt?: Date;
  take?: number;
}): Promise<ViewerPackageReminderCandidate[]> {
  const take = Math.min(2000, Math.max(1, options?.take ?? 500));
  const users = await prisma.user.findMany({
    where: {
      role: "SUBSCRIBER",
      email: { not: null },
      ...(options?.createdAtGte || options?.createdAtLt
        ? {
            createdAt: {
              ...(options.createdAtGte ? { gte: options.createdAtGte } : {}),
              ...(options.createdAtLt ? { lt: options.createdAtLt } : {}),
            },
          }
        : {}),
      NOT: {
        viewerSubscriptions: {
          some: {
            viewerModel: "SUBSCRIPTION",
            status: { in: [...ENGAGED_SUB_STATUSES] },
          },
        },
      },
    },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take,
  });

  return users
    .map((u) => ({
      userId: u.id,
      email: (u.email ?? "").trim().toLowerCase(),
      name: u.name,
      createdAt: u.createdAt,
    }))
    .filter((u) => Boolean(u.email));
}

export async function filterAlreadyReminded(
  candidates: ViewerPackageReminderCandidate[],
): Promise<ViewerPackageReminderCandidate[]> {
  if (candidates.length === 0) return [];
  const emails = candidates.map((c) => c.email);
  const sent = await db.emailCampaignDelivery.findMany({
    where: {
      campaignKey: VIEWER_PACKAGE_REMINDER_CAMPAIGN,
      email: { in: emails },
    },
    select: { email: true },
  });
  const sentSet = new Set(sent.map((row: { email: string }) => row.email.toLowerCase()));
  return candidates.filter((c) => !sentSet.has(c.email));
}

export async function recordViewerPackageReminderSent(args: {
  userId?: string | null;
  email: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  await db.emailCampaignDelivery.upsert({
    where: {
      email_campaignKey: {
        email,
        campaignKey: VIEWER_PACKAGE_REMINDER_CAMPAIGN,
      },
    },
    create: {
      userId: args.userId ?? null,
      email,
      campaignKey: VIEWER_PACKAGE_REMINDER_CAMPAIGN,
      metadata: args.metadata ?? undefined,
    },
    update: {
      sentAt: new Date(),
      userId: args.userId ?? undefined,
      metadata: args.metadata ?? undefined,
    },
  });
}

export async function sendViewerPackageReminderOnce(args: {
  userId?: string | null;
  email: string;
  name?: string | null;
  /** When true, still send even if already logged (use for admin test only). */
  force?: boolean;
  dryRun?: boolean;
}): Promise<{ sent: boolean; skipped?: string }> {
  const email = args.email.trim().toLowerCase();
  if (!email) return { sent: false, skipped: "missing_email" };

  if (!args.force) {
    const existing = await db.emailCampaignDelivery.findUnique({
      where: {
        email_campaignKey: {
          email,
          campaignKey: VIEWER_PACKAGE_REMINDER_CAMPAIGN,
        },
      },
      select: { id: true },
    });
    if (existing) return { sent: false, skipped: "already_sent" };
  }

  if (args.dryRun) return { sent: false, skipped: "dry_run" };

  await sendViewerPackageReminderEmail(email, {
    name: args.name,
    packageUrl: packageOnboardingUrl(),
  });

  await recordViewerPackageReminderSent({
    userId: args.userId,
    email,
    metadata: { force: Boolean(args.force) },
  });

  return { sent: true };
}

/**
 * Morning-of-second-day window in Africa/Johannesburg:
 * accounts created on the calendar day that is exactly 2 days before "today".
 */
export function secondDaySignupWindow(now = new Date()): { createdAtGte: Date; createdAtLt: Date } {
  // Approximate SAST as UTC+2 (no DST). Cron is scheduled for morning SAST.
  const sastOffsetMs = 2 * 60 * 60 * 1000;
  const sastNow = new Date(now.getTime() + sastOffsetMs);
  const y = sastNow.getUTCFullYear();
  const m = sastNow.getUTCMonth();
  const d = sastNow.getUTCDate();

  const startOfTodaySastUtc = Date.UTC(y, m, d, 0, 0, 0, 0) - sastOffsetMs;
  const createdAtGte = new Date(startOfTodaySastUtc - 2 * 24 * 60 * 60 * 1000);
  const createdAtLt = new Date(startOfTodaySastUtc - 1 * 24 * 60 * 60 * 1000);
  return { createdAtGte, createdAtLt };
}

export async function processDueViewerPackageReminders(now = new Date()): Promise<{
  scanned: number;
  eligible: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const window = secondDaySignupWindow(now);
  const candidates = await listInactiveViewerPackageCandidates({
    createdAtGte: window.createdAtGte,
    createdAtLt: window.createdAtLt,
    take: 500,
  });
  const eligible = await filterAlreadyReminded(candidates);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of eligible) {
    try {
      const result = await sendViewerPackageReminderOnce({
        userId: row.userId,
        email: row.email,
        name: row.name,
      });
      if (result.sent) sent += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${row.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    scanned: candidates.length,
    eligible: eligible.length,
    sent,
    failed,
    errors: errors.slice(0, 20),
  };
}

export async function countInactiveViewersNeedingReminder(): Promise<{
  inactive: number;
  alreadySent: number;
  remaining: number;
}> {
  const candidates = await listInactiveViewerPackageCandidates({ take: 2000 });
  const remaining = await filterAlreadyReminded(candidates);
  return {
    inactive: candidates.length,
    alreadySent: candidates.length - remaining.length,
    remaining: remaining.length,
  };
}
