import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";

export async function GET() {
  const now = new Date();
  const companies = await prisma.cateringCompany.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          companySubscriptions: {
            where: { companyType: "CATERING_COMPANY", status: "ACTIVE", currentPeriodEnd: { gt: now } },
            take: 1,
            select: { plan: true },
          },
        },
      },
      _count: { select: { bookings: true } },
    },
  });
  const sorted = [...companies].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  return NextResponse.json(sorted);
}
