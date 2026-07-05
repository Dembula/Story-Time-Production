import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  estimateLocationTotalForDates,
  shapeLocationQuoteProfile,
} from "@/lib/marketplace-public-catalog";

interface Params {
  params: Promise<{ id: string }>;
}

/** Authenticated creators see daily/hourly rates for quoting (not on public catalog list). */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.email || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const startDate = req.nextUrl.searchParams.get("startDate");
  const endDate = req.nextUrl.searchParams.get("endDate");

  const location = await prisma.locationListing.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
    },
  });
  if (!location) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const quoteProfile = shapeLocationQuoteProfile(location);
  const estimate =
    startDate && endDate ? estimateLocationTotalForDates(location, startDate, endDate) : null;

  return NextResponse.json({
    ...quoteProfile,
    estimate: estimate
      ? {
          startDate,
          endDate,
          days: estimate.days,
          subtotal: estimate.subtotal,
          dailyRate: estimate.dailyRate,
        }
      : null,
  });
}
