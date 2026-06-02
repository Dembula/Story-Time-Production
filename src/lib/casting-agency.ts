import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";

export type CastingAgencySession = {
  userId: string;
  role: string;
};

export async function requireCastingAgencySession(): Promise<
  { ok: true; session: CastingAgencySession } | { ok: false; status: number; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session) return { ok: false, status: 401, error: "Unauthorized" };

  const role = (session.user as { role?: string })?.role ?? "";
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, session: { userId, role } };
}

export async function getAgencyForUser(userId: string) {
  return prisma.castingAgency.findUnique({
    where: { userId },
    include: {
      _count: {
        select: {
          talent: true,
          inquiries: true,
          castingInvitations: true,
          auditionSubmissions: true,
        },
      },
    },
  });
}

export function parseTalentProfile(talent: { bio: string | null; agencyCommissionPercent?: number | null; representationType?: string | null }) {
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
  };
}

export const AUDITION_SUBMISSION_STATUSES = [
  "SUBMITTED",
  "SHORTLISTED",
  "CALLBACK",
  "BOOKED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export const AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "BOOKED", "UNAVAILABLE"] as const;

export const REPRESENTATION_TYPES = ["EXCLUSIVE", "NON_EXCLUSIVE", "FREELANCE"] as const;
