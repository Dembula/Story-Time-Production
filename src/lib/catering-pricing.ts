import { parseCateringCompanyProfile } from "@/lib/company-marketplace-profiles";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";

/** Catering checkout base: quoted amount wins, else per-head × headcount with min-order floor. */
export function computeCateringBaseZar(args: {
  quotedAmount?: number | null;
  pricePerHead?: number | null;
  headCount?: number | null;
  minOrder?: number | null;
}): number {
  if (args.quotedAmount != null && args.quotedAmount > 0) {
    return Math.round(args.quotedAmount * 100) / 100;
  }

  const perHead = args.pricePerHead ?? 0;
  const heads = args.headCount ?? 0;
  let subtotal = perHead > 0 && heads > 0 ? perHead * heads : 0;
  const minOrder = args.minOrder ?? 0;

  if (subtotal > 0 && minOrder > 0) {
    subtotal = Math.max(subtotal, minOrder);
  } else if (subtotal <= 0 && minOrder > 0) {
    subtotal = minOrder;
  }

  if (subtotal <= 0) return 0;
  return Math.round(subtotal * 100) / 100;
}

export function buildCateringPayQuote(baseAmount: number) {
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
  return { baseAmount, feeAmount, totalAmount };
}

export type CateringCompanyRow = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  specializations: string | null;
  minOrder?: number | null;
  logoUrl?: string | null;
  website?: string | null;
  user?: {
    id: string;
    name: string | null;
    companySubscriptions?: { plan: string }[];
  };
  _count?: { bookings: number };
};

/** Public on-set catalog card — photos & specializations only; no rates or vendor email. */
export function shapeCateringListingForPublicCatalog(row: CateringCompanyRow) {
  const profile = parseCateringCompanyProfile(row);
  return {
    id: row.id,
    companyName: row.companyName,
    tagline: row.tagline,
    city: row.city,
    country: row.country,
    specializations: row.specializations,
    logoUrl: row.logoUrl ?? profile.logoUrl,
    previewImageUrl: row.logoUrl ?? profile.galleryUrls[0] ?? null,
    website: row.website ?? null,
    _count: row._count ?? { bookings: 0 },
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          companySubscriptions: row.user.companySubscriptions ?? [],
        }
      : undefined,
    profile: {
      plainDescription: profile.plainDescription,
      galleryUrls: profile.galleryUrls,
      menuHighlights: profile.menuHighlights,
      serviceTypes: profile.serviceTypes,
      minHeadCount: profile.meta?.minHeadCount ?? null,
      maxHeadCount: profile.meta?.maxHeadCount ?? null,
      logoUrl: profile.logoUrl,
    },
  };
}

/** Caterer quote profile — shown when a creator opens a company profile to plan a booking. */
export function shapeCateringQuoteProfile(row: CateringCompanyRow) {
  const profile = parseCateringCompanyProfile(row);
  return {
    id: row.id,
    companyName: row.companyName,
    pricePerHead: profile.pricePerHead,
    minOrder: profile.minOrder,
    minHeadCount: profile.meta?.minHeadCount ?? null,
    maxHeadCount: profile.meta?.maxHeadCount ?? null,
    menuHighlights: profile.menuHighlights,
    serviceTypes: profile.serviceTypes,
    plainDescription: profile.plainDescription,
    galleryUrls: profile.galleryUrls,
  };
}

export function estimateCateringTotalForHeads(
  row: CateringCompanyRow,
  headCount: number,
): { subtotal: number; pricePerHead: number | null; minOrder: number | null } {
  const profile = parseCateringCompanyProfile(row);
  const subtotal = computeCateringBaseZar({
    pricePerHead: profile.pricePerHead,
    headCount,
    minOrder: profile.minOrder,
  });
  return {
    subtotal,
    pricePerHead: profile.pricePerHead,
    minOrder: profile.minOrder,
  };
}
