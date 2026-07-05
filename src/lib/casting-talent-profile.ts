import { parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";

export function parseTalentProfile(talent: {
  bio: string | null;
  agencyCommissionPercent?: number | null;
  representationType?: string | null;
}) {
  const { plain, meta } = parseEmbeddedMeta<ActorMarketMeta>(talent.bio);
  return {
    plainBio: plain,
    meta,
    agencyCommissionPercent: talent.agencyCommissionPercent ?? meta?.agencyCommissionPercent ?? null,
    representationType: talent.representationType ?? null,
    dailyRate: meta?.dailyRate ?? null,
    projectRate: meta?.projectRate ?? null,
    hourlyRate: meta?.hourlyRate ?? null,
    weeklyRate: meta?.weeklyRate ?? null,
    availability: meta?.availability ?? null,
    availabilityStatus: meta?.availabilityStatus ?? null,
    location: meta?.location ?? null,
    languages: meta?.languages ?? [],
    experienceLevel: meta?.experienceLevel ?? null,
    phone: meta?.phone ?? null,
    contactEmail: meta?.contactEmail ?? null,
    agentName: meta?.agentName ?? null,
    unionStatus: meta?.unionStatus ?? null,
    height: meta?.height ?? null,
    weight: meta?.weight ?? null,
    eyeColor: meta?.eyeColor ?? null,
    hairColor: meta?.hairColor ?? null,
    ethnicity: meta?.ethnicity ?? null,
    gender: meta?.gender ?? null,
    specialSkills: meta?.specialSkills ?? [],
    portfolioUrl: meta?.portfolioUrl ?? null,
    socialLinks: meta?.socialLinks ?? [],
    travelWillingness: meta?.travelWillingness ?? null,
    driversLicense: meta?.driversLicense ?? null,
  };
}

export const REPRESENTATION_TYPES = ["EXCLUSIVE", "NON_EXCLUSIVE", "FREELANCE"] as const;
