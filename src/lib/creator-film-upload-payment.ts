import { prisma } from "@/lib/prisma";
import {
  CREATOR_PER_FILM_UPLOAD_PRICE,
  isCreatorPerFilmLicense,
  isCreatorLicensePeriodActive,
} from "@/lib/pricing";
import { CREATOR_APPLE_IAP_UPLOAD_PURPOSE } from "@/lib/payments/apple-iap/purposes";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

export const CREATOR_FILM_UPLOAD_PURPOSE = "creator_film_upload";

/** Web PayFast and iOS StoreKit per-film upload fee purposes. */
export const CREATOR_FILM_UPLOAD_PURPOSES = [
  CREATOR_FILM_UPLOAD_PURPOSE,
  CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
] as const;

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
      purpose: { in: [...CREATOR_FILM_UPLOAD_PURPOSES] },
    },
    select: { id: true },
  });
  return Boolean(paid);
}

export function perFilmUploadAmount(): number {
  return CREATOR_PER_FILM_UPLOAD_PRICE;
}

/** Start (or retry) PayFast/demo checkout for a per-film catalogue upload fee. */
export async function initializeCreatorFilmUploadCheckout(args: {
  userId: string;
  email?: string | null;
  customerName?: string | null;
  contentId: string;
  contentTitle?: string | null;
  contentType?: string | null;
}) {
  const amount = perFilmUploadAmount();
  const checkout = await initializeCheckout({
    userId: args.userId,
    email: args.email,
    customerName: args.customerName,
    amount,
    purpose: CREATOR_FILM_UPLOAD_PURPOSE,
    referenceType: "Content",
    referenceId: args.contentId,
    returnUrl: buildPaymentReturnUrl("/creator/dashboard", "creator_film_upload"),
    metadata: {
      contentTitle: args.contentTitle ?? undefined,
      contentType: args.contentType ?? undefined,
    },
  });
  return {
    amount,
    checkoutUrl: checkout.checkout.checkoutUrl,
    paymentRecordId: checkout.paymentRecord.id,
  };
}
