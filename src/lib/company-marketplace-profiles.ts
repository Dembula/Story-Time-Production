import { parseEmbeddedMeta, type ActorMarketMeta, type CrewMarketMeta, type EquipmentMarketMeta, type LocationMarketMeta } from "@/lib/marketplace-profile-meta";
import { parseTalentProfile } from "@/lib/casting-talent-profile";
import { parsePhotoUrls } from "@/lib/marketplace-media";

export type CateringMarketMeta = {
  galleryUrls?: string[];
  menuHighlights?: string[];
  serviceTypes?: string[];
  minHeadCount?: number | null;
  maxHeadCount?: number | null;
  pricePerHead?: number | null;
};

export function parseCateringCompanyProfile(row: {
  description: string | null;
  minOrder?: number | null;
  logoUrl?: string | null;
}) {
  const { plain, meta } = parseEmbeddedMeta<CateringMarketMeta>(row.description);
  return {
    plainDescription: plain,
    meta,
    logoUrl: row.logoUrl ?? null,
    galleryUrls: meta?.galleryUrls ?? [],
    menuHighlights: meta?.menuHighlights ?? [],
    serviceTypes: meta?.serviceTypes ?? [],
    minOrder: row.minOrder ?? null,
    pricePerHead: meta?.pricePerHead ?? null,
  };
}

export function parseCrewMemberProfile(member: { bio: string | null }) {
  const { plain, meta } = parseEmbeddedMeta<CrewMarketMeta>(member.bio);
  return {
    plainBio: plain,
    meta,
    role: meta?.role ?? null,
    department: meta?.department ?? null,
    dailyRate: meta?.dailyRate ?? null,
    availability: meta?.availability ?? null,
    location: meta?.location ?? null,
    experienceLevel: meta?.experienceLevel ?? null,
    hourlyRate: meta?.hourlyRate ?? null,
    weeklyRate: meta?.weeklyRate ?? null,
    projectRate: meta?.projectRate ?? null,
    tools: meta?.tools ?? [],
    phone: meta?.phone ?? null,
    contactEmail: meta?.contactEmail ?? null,
    certifications: meta?.certifications ?? [],
    unionStatus: meta?.unionStatus ?? null,
    yearsExperience: meta?.yearsExperience ?? null,
    portfolioUrl: meta?.portfolioUrl ?? null,
    reelUrl: meta?.reelUrl ?? null,
    travelWillingness: meta?.travelWillingness ?? null,
    ownEquipment: meta?.ownEquipment ?? null,
    languages: meta?.languages ?? [],
  };
}

export function shapeEquipmentListingForMarketplace(row: {
  id: string;
  companyName: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  contactUrl: string | null;
  location: string | null;
  company?: { id: string; name: string | null } | null;
}) {
  const parsed = parseEmbeddedMeta<EquipmentMarketMeta>(row.description);
  return {
    ...row,
    plainDescription: parsed.plain,
    profile: {
      name: parsed.plain || row.companyName,
      category: row.category,
      specifications: parsed.meta?.specifications ?? null,
      dailyRate: parsed.meta?.dailyRate ?? null,
      weeklyRate: parsed.meta?.weeklyRate ?? null,
      deposit: parsed.meta?.deposit ?? null,
      quantityAvailable: parsed.meta?.quantityAvailable ?? null,
      availability: parsed.meta?.availability ?? null,
      galleryUrls: parsed.meta?.galleryUrls ?? [],
    },
    photos: parsed.meta?.galleryUrls?.length
      ? parsed.meta.galleryUrls
      : row.imageUrl
        ? [row.imageUrl]
        : [],
    previewImageUrl: parsed.meta?.galleryUrls?.[0] ?? row.imageUrl,
  };
}

export function shapeLocationListingForMarketplace<T extends {
  id: string;
  name: string;
  description: string | null;
  type: string;
  photoUrls: string | null;
  dailyRate: number | null;
  availability: string | null;
  rules: string | null;
  city: string | null;
  capacity: number | null;
  amenities: string | null;
}>(location: T) {
  const parsed = parseEmbeddedMeta<LocationMarketMeta>(location.rules);
  const photos = parsePhotoUrls(location.photoUrls);
  return {
    ...location,
    photos,
    previewImageUrl: photos[0] ?? null,
    profile: {
      permitRequirements: parsed.meta?.permitNotes ?? null,
      restrictions: parsed.meta?.restrictions ?? parsed.plain,
      hourlyRate: parsed.meta?.hourlyRate ?? null,
      dailyRate: parsed.meta?.dailyRate ?? location.dailyRate ?? null,
      availability: location.availability ?? parsed.meta?.availability ?? null,
      logistics: parsed.meta?.logistics ?? null,
    },
  };
}

export function shapeCastingTalentForMarketplace(talent: Parameters<typeof parseTalentProfile>[0] & {
  id: string;
  name: string;
  headshotUrl: string | null;
  cvUrl: string | null;
  reelUrl: string | null;
  ageRange: string | null;
  skills: string | null;
  pastWork: string | null;
}) {
  const profile = parseTalentProfile(talent);
  return {
    ...talent,
    profile,
    plainBio: profile.plainBio,
    previewImageUrl: talent.headshotUrl,
  };
}
