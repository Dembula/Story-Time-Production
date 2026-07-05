import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";
import { MARKETPLACE_TRANSACTION_TYPE, sumPayeeCompletedAmount } from "@/lib/financial-ledger";

export async function GET() {
  try {
    const auth = await requireCompanySession(["CATERING_COMPANY", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const company = await prisma.cateringCompany.findUnique({
      where: { userId: auth.userId },
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { creator: { select: { name: true } } },
        },
        _count: { select: { bookings: true } },
      },
    });

    if (!company) return NextResponse.json({ error: "Create catering profile first" }, { status: 404 });

    const revenue = await sumPayeeCompletedAmount(auth.userId, MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING);

    return NextResponse.json({
      company: {
        id: company.id,
        companyName: company.companyName,
        tagline: company.tagline,
        logoUrl: company.logoUrl,
        counts: company._count,
      },
      metrics: {
        totalBookings: company._count.bookings,
        pending: company.bookings.filter((b) => b.status === "PENDING").length,
        confirmed: company.bookings.filter((b) => b.status === "APPROVED").length,
        paid: company.bookings.filter((b) => b.paymentTransactionId != null).length,
        revenue,
      },
      recentBookings: company.bookings,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load catering overview.");
    return NextResponse.json({ error: message }, { status });
  }
}
