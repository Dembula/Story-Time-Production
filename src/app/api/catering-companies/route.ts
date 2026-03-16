import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const companies = await prisma.cateringCompany.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          companySubscriptions: { where: { companyType: "CATERING_COMPANY", status: "ACTIVE" }, take: 1, select: { plan: true } },
        },
      },
      _count: { select: { bookings: true } },
    },
  });
  const sorted = [...companies].sort((a, b) => {
    const promotedA = (a.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    const promotedB = (b.user as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    return promotedA - promotedB || (a.companyName || "").localeCompare(b.companyName || "");
  });
  return NextResponse.json(sorted);
}
