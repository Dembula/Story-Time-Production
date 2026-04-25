import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";
import { parseEmbeddedMeta, type ActorMarketMeta, listIncludes } from "@/lib/marketplace-profile-meta";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const country = searchParams.get("country");
  const location = searchParams.get("location");
  const experienceLevel = searchParams.get("experienceLevel");
  const skills = searchParams.get("skills");
  const availability = searchParams.get("availability");
  const minRate = Number(searchParams.get("minRate") ?? "");
  const maxRate = Number(searchParams.get("maxRate") ?? "");
  const now = new Date();
  const where: { city?: string; country?: string } = {};
  if (city) where.city = city;
  if (country) where.country = country;
  const agencies = await prisma.castingAgency.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          companySubscriptions: {
            where: { companyType: "CASTING_AGENCY", status: "ACTIVE", currentPeriodEnd: { gt: now } },
            take: 1,
            select: { plan: true },
          },
        },
      },
      _count: { select: { talent: true, inquiries: true } },
      talent: true,
    },
  });
  const sorted = [...agencies].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.agencyName || "").localeCompare(b.agencyName || "");
  });
  const shaped = sorted
    .map((agency) => {
      const talent = agency.talent
        .map((person) => {
          const parsed = parseEmbeddedMeta<ActorMarketMeta>(person.bio);
          const dailyRate = parsed.meta?.dailyRate ?? null;
          const passMin = Number.isFinite(minRate) ? (dailyRate ?? 0) >= minRate : true;
          const passMax = Number.isFinite(maxRate) ? (dailyRate ?? 0) <= maxRate : true;
          if (!passMin || !passMax) return null;
          if (location && !(parsed.meta?.location ?? "").toLowerCase().includes(location.toLowerCase())) return null;
          if (experienceLevel && !(parsed.meta?.experienceLevel ?? "").toLowerCase().includes(experienceLevel.toLowerCase())) return null;
          if (availability && !(parsed.meta?.availability ?? "").toLowerCase().includes(availability.toLowerCase())) return null;
          if (!listIncludes(person.skills, skills)) return null;
          return {
            id: person.id,
            fullName: person.name,
            profilePhoto: person.headshotUrl,
            ageRange: person.ageRange,
            gender: person.gender,
            location: parsed.meta?.location ?? null,
            languages: parsed.meta?.languages ?? [],
            skills: (person.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            experienceLevel: parsed.meta?.experienceLevel ?? null,
            showreel: person.reelUrl,
            pastWork: person.pastWork ?? parsed.plain,
            dailyRate,
            projectRate: parsed.meta?.projectRate ?? null,
            availability: parsed.meta?.availability ?? null,
            contactRestricted: (parsed.meta?.contactVisibility ?? "PRIVATE") !== "PUBLIC",
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      return { ...agency, talent };
    })
    .filter((agency) => agency.talent.length > 0 || (!skills && !experienceLevel && !availability && !location));
  return NextResponse.json(shaped);
}
