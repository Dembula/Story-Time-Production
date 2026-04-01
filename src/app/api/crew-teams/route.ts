import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const country = searchParams.get("country");
  const spec = searchParams.get("specialization");
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
    },
  });
  const sorted = [...teams].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  return NextResponse.json(sorted);
}
