import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { getLocationOwnerFinancialSnapshot } from "@/lib/financial-ledger";
import { requireCompanySession } from "@/lib/company-ops";

export async function GET() {
  try {
    const auth = await requireCompanySession(["LOCATION_OWNER", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [listings, bookings, financials] = await Promise.all([
      prisma.locationListing.findMany({
        where: { companyId: auth.userId },
        select: { id: true, name: true, type: true, city: true, dailyRate: true, photoUrls: true },
      }),
      prisma.locationBooking.findMany({
        where: { ownerId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          location: { select: { name: true, type: true, photoUrls: true, dailyRate: true } },
          requester: { select: { name: true } },
        },
      }),
      getLocationOwnerFinancialSnapshot(auth.userId),
    ]);

    const pending = bookings.filter((b) => b.status === "PENDING").length;

    return NextResponse.json({
      metrics: {
        listings: listings.length,
        totalBookings: bookings.length,
        pending,
        settledRevenue: financials.settledRevenue ?? 0,
        pipelineEstimate: financials.pipelineEstimate ?? 0,
      },
      listings,
      recentBookings: bookings,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load location overview.");
    return NextResponse.json({ error: message }, { status });
  }
}
