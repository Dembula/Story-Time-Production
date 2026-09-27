import { CREATOR_LICENSE_TYPE } from "@/lib/pricing";

import { prisma } from "@/lib/prisma";

/** Same length as the viewer catalogue free trial. */
export const CREATOR_PIPELINE_TRIAL_MS = 30 * 24 * 60 * 60 * 1000;

export const CREATOR_TRIAL_CONSENT_PREFIX = "creator-trial-consent-";

export function creatorTrialConsentReference(licenseId: string): string {
  return `${CREATOR_TRIAL_CONSENT_PREFIX}${licenseId}`;
}

export function parseCreatorTrialConsentLicenseId(reference: string): string | null {
  if (!reference.startsWith(CREATOR_TRIAL_CONSENT_PREFIX)) return null;
  const id = reference.slice(CREATOR_TRIAL_CONSENT_PREFIX.length).trim();
  return id || null;
}

/** True once a pipeline monthly free trial has started (card saved / trial clock running or finished). */
export async function creatorHasUsedPipelineFreeTrial(userId: string): Promise<boolean> {
  const rows = await prisma.creatorDistributionLicense.findMany({
    where: { userId },
    select: { status: true, trialEndsAt: true },
  });
  return rows.some((row) => row.trialEndsAt != null || row.status === "TRIAL_ACTIVE");
}

export function isCreatorTrialCardPending(license?: { status?: string | null } | null): boolean {
  return license?.status === "TRIAL_CARD_PENDING";
}

export function isCreatorTrialActive(license?: {
  status?: string | null;
  trialEndsAt?: Date | string | null;
} | null): boolean {
  if (!license || license.status !== "TRIAL_ACTIVE") return false;
  if (!license.trialEndsAt) return false;
  return new Date(license.trialEndsAt).getTime() > Date.now();
}
