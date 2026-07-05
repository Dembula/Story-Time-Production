import {
  shapeEquipmentListingForMarketplace,
  shapeLocationListingForMarketplace,
} from "@/lib/company-marketplace-profiles";
import { computeLocationBookingBaseZar } from "@/lib/financial-ledger";
import { computeEquipmentRequestBaseZar } from "@/lib/equipment-request-base-zar";

/** Public location catalog card — photos & logistics only; no rates or owner contact. */
export function shapeLocationListingForPublicCatalog<T extends Parameters<typeof shapeLocationListingForMarketplace>[0]>(
  location: T,
) {
  const item = shapeLocationListingForMarketplace(location);
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    type: item.type,
    address: "address" in item ? (item as { address?: string | null }).address ?? null : null,
    city: item.city,
    province: "province" in item ? (item as { province?: string | null }).province ?? null : null,
    country: "country" in item ? (item as { country?: string | null }).country ?? null : null,
    capacity: item.capacity,
    amenities: item.amenities,
    availability: item.profile.availability,
    photos: item.photos,
    previewImageUrl: item.previewImageUrl,
    company:
      "company" in item
        ? (item as { company?: { id: string; name: string | null } | null }).company ?? null
        : null,
    _count: "_count" in item ? (item as { _count?: { bookings?: number } })._count : undefined,
    profile: {
      permitRequirements: item.profile.permitRequirements,
      restrictions: item.profile.restrictions,
      logistics: item.profile.logistics,
      availability: item.profile.availability,
    },
  };
}

/** Location quote profile — rates shown when a creator opens a listing to plan a booking. */
export function shapeLocationQuoteProfile<T extends Parameters<typeof shapeLocationListingForMarketplace>[0]>(
  location: T,
) {
  const item = shapeLocationListingForMarketplace(location);
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    city: item.city,
    capacity: item.capacity,
    amenities: item.amenities,
    availability: item.profile.availability,
    dailyRate: item.profile.dailyRate ?? item.dailyRate ?? null,
    hourlyRate: item.profile.hourlyRate ?? null,
    permitRequirements: item.profile.permitRequirements,
    restrictions: item.profile.restrictions,
    logistics: item.profile.logistics,
    photos: item.photos,
  };
}

export function estimateLocationTotalForDates(
  location: Parameters<typeof shapeLocationListingForMarketplace>[0],
  startDate: string,
  endDate: string,
): { subtotal: number; dailyRate: number | null; days: number } | null {
  const profile = shapeLocationQuoteProfile(location);
  if (!startDate || !endDate) return null;
  const subtotal = computeLocationBookingBaseZar({
    dailyRate: profile.dailyRate,
    startDate,
    endDate,
  });
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
  return { subtotal, dailyRate: profile.dailyRate, days };
}

/** Public equipment catalog card — photos & specs only; no rates or vendor contact. */
export function shapeEquipmentListingForPublicCatalog(
  row: Parameters<typeof shapeEquipmentListingForMarketplace>[0],
) {
  const item = shapeEquipmentListingForMarketplace(row);
  return {
    id: item.id,
    companyName: item.companyName,
    plainDescription: item.plainDescription,
    category: item.category,
    location: item.location,
    previewImageUrl: item.previewImageUrl,
    photos: item.photos,
    company: item.company ?? null,
    profile: {
      specifications: item.profile.specifications,
      quantityAvailable: item.profile.quantityAvailable,
      availability: item.profile.availability,
      galleryUrls: item.profile.galleryUrls,
    },
  };
}

/** Equipment quote profile — rates shown when a creator opens a listing to request hire. */
export function shapeEquipmentQuoteProfile(row: Parameters<typeof shapeEquipmentListingForMarketplace>[0]) {
  const item = shapeEquipmentListingForMarketplace(row);
  return {
    id: item.id,
    companyName: item.companyName,
    category: item.category,
    location: item.location,
    plainDescription: item.plainDescription,
    specifications: item.profile.specifications,
    dailyRate: item.profile.dailyRate ?? null,
    weeklyRate: item.profile.weeklyRate ?? null,
    deposit: item.profile.deposit ?? null,
    quantityAvailable: item.profile.quantityAvailable ?? null,
    availability: item.profile.availability ?? null,
    galleryUrls: item.profile.galleryUrls,
    photos: item.photos,
  };
}

export function estimateEquipmentTotalForDates(
  row: Parameters<typeof shapeEquipmentListingForMarketplace>[0],
  startDate: string,
  endDate: string,
): { subtotal: number; dailyRate: number | null; days: number } | null {
  if (!startDate || !endDate) return null;
  const item = shapeEquipmentListingForMarketplace(row);
  const subtotal = computeEquipmentRequestBaseZar({
    equipmentDescription: row.description,
    startDate,
    endDate,
  });
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
  const dailyRate = item.profile.dailyRate ?? null;
  return { subtotal, dailyRate, days };
}
