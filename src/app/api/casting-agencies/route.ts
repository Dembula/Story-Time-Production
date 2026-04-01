import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const country = searchParams.get("country");
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
    },
  });
  const sorted = [...agencies].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.agencyName || "").localeCompare(b.agencyName || "");
  });
  return NextResponse.json(sorted);
}
