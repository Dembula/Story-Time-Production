import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  MapPin,
  UtensilsCrossed,
  Users,
  Wrench,
} from "lucide-react";

export type MarketplaceCategoryId =
  | "casting"
  | "crew"
  | "locations"
  | "equipment"
  | "catering";

export type MarketplaceCategory = {
  id: MarketplaceCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  browseLabel: string;
  icon: LucideIcon;
  accent: string;
  accentBorder: string;
  accentBg: string;
  browsePath: string;
  listApi: string;
  listingKind: "company" | "location" | "equipment";
};

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  {
    id: "casting",
    label: "Casting & Auditions",
    shortLabel: "Casting",
    description: "Agencies, talent rosters, headshots, and paid audition listings.",
    browseLabel: "Browse casting agencies",
    icon: Clapperboard,
    accent: "text-violet-300",
    accentBorder: "border-violet-400/30",
    accentBg: "bg-violet-500/10",
    browsePath: "/creator/cast",
    listApi: "/api/casting-agencies",
    listingKind: "company",
  },
  {
    id: "crew",
    label: "Crew Teams",
    shortLabel: "Crew",
    description: "Departments, day rates, and vetted crew companies for your shoot.",
    browseLabel: "Browse crew teams",
    icon: Users,
    accent: "text-emerald-300",
    accentBorder: "border-emerald-400/30",
    accentBg: "bg-emerald-500/10",
    browsePath: "/creator/crew",
    listApi: "/api/crew-teams",
    listingKind: "company",
  },
  {
    id: "locations",
    label: "Locations",
    shortLabel: "Locations",
    description: "Studios, houses, warehouses, and on-location sets with booking flows.",
    browseLabel: "Browse locations",
    icon: MapPin,
    accent: "text-sky-300",
    accentBorder: "border-sky-400/30",
    accentBg: "bg-sky-500/10",
    browsePath: "/creator/locations",
    listApi: "/api/locations",
    listingKind: "location",
  },
  {
    id: "equipment",
    label: "Equipment",
    shortLabel: "Equipment",
    description: "Cameras, lighting, grip, and sound gear from verified rental houses.",
    browseLabel: "Browse equipment",
    icon: Wrench,
    accent: "text-amber-300",
    accentBorder: "border-amber-400/30",
    accentBg: "bg-amber-500/10",
    browsePath: "/creator/equipment",
    listApi: "/api/equipment",
    listingKind: "equipment",
  },
  {
    id: "catering",
    label: "On-set Catering",
    shortLabel: "Catering",
    description: "Meal plans, head-count pricing, and on-set catering partners.",
    browseLabel: "Browse catering companies",
    icon: UtensilsCrossed,
    accent: "text-orange-300",
    accentBorder: "border-orange-400/30",
    accentBg: "bg-orange-500/10",
    browsePath: "/creator/catering",
    listApi: "/api/catering-companies",
    listingKind: "company",
  },
];

export function getMarketplaceCategory(id: string | null | undefined): MarketplaceCategory | undefined {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === id);
}

export function marketplaceBrowseHref(category: MarketplaceCategory, projectId?: string | null): string {
  if (!projectId) return category.browsePath;
  const params = new URLSearchParams({ projectId });
  return `${category.browsePath}?${params.toString()}`;
}

/** Professional listing detail storefront (used by hub cards). */
export function marketplaceListingHref(
  categoryId: MarketplaceCategoryId,
  listingId: string,
  projectId?: string | null,
): string {
  const base = `/creator/marketplace/${categoryId}/${encodeURIComponent(listingId)}`;
  if (!projectId) return base;
  return `${base}?projectId=${encodeURIComponent(projectId)}`;
}

export type MarketplaceStoreCard = {
  id: string;
  categoryId: MarketplaceCategoryId;
  title: string;
  subtitle: string | null;
  location: string | null;
  description: string | null;
  imageUrl: string | null;
  meta: string | null;
  href: string;
};

function locationLabel(city?: string | null, country?: string | null): string | null {
  const parts = [city, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function normalizeCastingAgency(
  row: {
    id: string;
    agencyName: string;
    tagline?: string | null;
    description?: string | null;
    city?: string | null;
    country?: string | null;
    _count?: { talent?: number };
  },
  projectId?: string | null,
): MarketplaceStoreCard {
  const category = getMarketplaceCategory("casting")!;
  const talentCount = row._count?.talent ?? 0;
  return {
    id: row.id,
    categoryId: "casting",
    title: row.agencyName,
    subtitle: row.tagline ?? null,
    location: locationLabel(row.city, row.country),
    description: row.description ?? null,
    imageUrl: null,
    meta: talentCount > 0 ? `${talentCount} talent on roster` : "Casting agency",
    href: marketplaceListingHref("casting", row.id, projectId),
  };
}

export function normalizeCrewTeam(
  row: {
    id: string;
    companyName: string;
    tagline?: string | null;
    description?: string | null;
    city?: string | null;
    country?: string | null;
    specializations?: string | null;
    _count?: { members?: number };
  },
  projectId?: string | null,
): MarketplaceStoreCard {
  const category = getMarketplaceCategory("crew")!;
  const memberCount = row._count?.members ?? 0;
  return {
    id: row.id,
    categoryId: "crew",
    title: row.companyName,
    subtitle: row.tagline ?? row.specializations ?? null,
    location: locationLabel(row.city, row.country),
    description: row.description ?? null,
    imageUrl: null,
    meta: memberCount > 0 ? `${memberCount} crew members` : "Crew team",
    href: marketplaceListingHref("crew", row.id, projectId),
  };
}

export function normalizeLocation(
  row: {
    id: string;
    name: string;
    type?: string | null;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    previewImageUrl?: string | null;
    company?: { name?: string | null } | null;
  },
  projectId?: string | null,
): MarketplaceStoreCard {
  const category = getMarketplaceCategory("locations")!;
  return {
    id: row.id,
    categoryId: "locations",
    title: row.name,
    subtitle: row.type ?? row.company?.name ?? null,
    location: locationLabel(row.city, row.country),
    description: row.description ?? null,
    imageUrl: row.previewImageUrl ?? null,
    meta: row.type ? `${row.type} location` : "Location listing",
    href: marketplaceListingHref("locations", row.id, projectId),
  };
}

export function normalizeEquipment(
  row: {
    id: string;
    companyName: string;
    category?: string | null;
    location?: string | null;
    plainDescription?: string | null;
    description?: string | null;
    previewImageUrl?: string | null;
    company?: { name?: string | null } | null;
  },
  projectId?: string | null,
): MarketplaceStoreCard {
  const category = getMarketplaceCategory("equipment")!;
  return {
    id: row.id,
    categoryId: "equipment",
    title: row.companyName,
    subtitle: row.category ?? row.company?.name ?? null,
    location: row.location ?? null,
    description: row.plainDescription ?? row.description ?? null,
    imageUrl: row.previewImageUrl ?? null,
    meta: row.category ? `${row.category} gear` : "Equipment listing",
    href: marketplaceListingHref("equipment", row.id, projectId),
  };
}

export function normalizeCateringCompany(
  row: {
    id: string;
    companyName: string;
    tagline?: string | null;
    description?: string | null;
    city?: string | null;
    country?: string | null;
    previewImageUrl?: string | null;
    _count?: { bookings?: number };
  },
  projectId?: string | null,
): MarketplaceStoreCard {
  const category = getMarketplaceCategory("catering")!;
  return {
    id: row.id,
    categoryId: "catering",
    title: row.companyName,
    subtitle: row.tagline ?? null,
    location: locationLabel(row.city, row.country),
    description: row.description ?? null,
    imageUrl: row.previewImageUrl ?? null,
    meta: "On-set catering",
    href: marketplaceListingHref("catering", row.id, projectId),
  };
}

export function matchesMarketplaceSearch(card: MarketplaceStoreCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [card.title, card.subtitle, card.location, card.description, card.meta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
