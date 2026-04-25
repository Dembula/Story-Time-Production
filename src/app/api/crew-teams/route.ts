import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";
import { parseEmbeddedMeta, type CrewMarketMeta } from "@/lib/marketplace-profile-meta";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const country = searchParams.get("country");
  const spec = searchParams.get("specialization");
  const role = searchParams.get("role");
  const department = searchParams.get("department");
  const experience = searchParams.get("experienceLevel");
  const availability = searchParams.get("availability");
  const minRate = Number(searchParams.get("minRate") ?? "");
  const maxRate = Number(searchParams.get("maxRate") ?? "");
  const now = new Date();
  const where: { city?: string; country?: string; specializations?: { contains: string } } = {};
  if (city) where.city = city;
  if (country) where.country = country;
  if (spec) where.specializations = { contains: spec };
  const teams = await prisma.crewTeam.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          companySubscriptions: {
            where: { companyType: "CREW_TEAM", status: "ACTIVE", currentPeriodEnd: { gt: now } },
            take: 1,
            select: { plan: true },
          },
        },
      },
      _count: { select: { members: true, requests: true } },
      members: true,
    },
  });
  const sorted = [...teams].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  const shaped = sorted
    .map((team) => {
      const members = team.members
        .map((member) => {
          const parsed = parseEmbeddedMeta<CrewMarketMeta>(member.bio);
          const rate = parsed.meta?.dailyRate ?? null;
          const passMin = Number.isFinite(minRate) ? (rate ?? 0) >= minRate : true;
          const passMax = Number.isFinite(maxRate) ? (rate ?? 0) <= maxRate : true;
          if (!passMin || !passMax) return null;
          if (role && !(member.role ?? "").toLowerCase().includes(role.toLowerCase())) return null;
          if (department && !(member.department ?? "").toLowerCase().includes(department.toLowerCase())) return null;
          if (experience && !(parsed.meta?.experienceLevel ?? "").toLowerCase().includes(experience.toLowerCase())) return null;
          if (availability && !(parsed.meta?.availability ?? "").toLowerCase().includes(availability.toLowerCase())) return null;
          if (spec && !(member.skills ?? "").toLowerCase().includes(spec.toLowerCase())) return null;
          return {
            id: member.id,
            name: member.name,
            role: member.role,
            department: member.department,
            experienceLevel: parsed.meta?.experienceLevel ?? null,
            dailyRate: rate,
            availability: parsed.meta?.availability ?? null,
            location: parsed.meta?.location ?? team.city ?? null,
            skills: (member.skills ?? "").split(",").map((s) => s.trim()).filter(Boolean),
            portfolio: member.pastWork ?? parsed.plain,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      return { ...team, members };
    })
    .filter((team) => team.members.length > 0 || (!role && !department && !experience && !availability && !spec));
  return NextResponse.json(shaped);
}
