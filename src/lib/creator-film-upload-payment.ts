import { prisma } from "@/lib/prisma";
import {
  CREATOR_PER_FILM_UPLOAD_PRICE,
  isCreatorPerFilmLicense,
  isCreatorLicensePeriodActive,
} from "@/lib/pricing";

export const CREATOR_FILM_UPLOAD_PURPOSE = "creator_film_upload";

const RESUBMIT_STATUSES = new Set(["REJECTED", "CHANGES_REQUESTED", "UNPUBLISHED"]);

/** True when the creator pays per film (no unlimited upload plan). */
export function creatorNeedsPerFilmUploadPayment(licenseType: string): boolean {
  return isCreatorPerFilmLicense(licenseType);
}

/** Yearly catalogue or active pipeline — unlimited uploads while the license period is valid. */
export function creatorHasUnlimitedUploads(license: {
  type: string;
  yearlyExpiresAt: Date | string | null;
}): boolean {
  if (isCreatorPerFilmLicense(license.type)) return false;
  return isCreatorLicensePeriodActive(license);
}

export function isResubmittableReviewStatus(status: string): boolean {
  return RESUBMIT_STATUSES.has(status);
}

export async function contentHasSuccessfulUploadPayment(contentId: string): Promise<boolean> {
  const paid = await prisma.paymentRecord.findFirst({
    where: {
      relatedEntityType: "Content",
      relatedEntityId: contentId,
      status: "SUCCEEDED",
      purpose: CREATOR_FILM_UPLOAD_PURPOSE,
    },
    select: { id: true },
  });
  return Boolean(paid);
}

export function perFilmUploadAmount(): number {
  return CREATOR_PER_FILM_UPLOAD_PRICE;
}
