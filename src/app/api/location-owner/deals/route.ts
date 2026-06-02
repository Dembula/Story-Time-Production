import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { firstPhotoUrl } from "@/lib/marketplace-media";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";

export async function GET() {
  try {
    const auth = await requireCompanySession(["LOCATION_OWNER", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const bookings = await prisma.locationBooking.findMany({
      where: { ownerId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        location: { select: { id: true, name: true, type: true, photoUrls: true, dailyRate: true, city: true } },
        requester: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    const pipeline = bookings.map((b) => ({
      id: b.id,
      kind: "LOCATION_BOOKING" as const,
      title: b.location.name,
      subtitle: [b.location.type, b.location.city, b.requester?.name].filter(Boolean).join(" · "),
      status: b.status,
      previewImageUrl: firstPhotoUrl(b.location.photoUrls),
      createdAt: b.createdAt.toISOString(),
      href: `/location-owner/bookings`,
      paid: Boolean(b.paymentTransactionId),
      shootWindow: [b.startDate, b.endDate].filter(Boolean).join(" → "),
      messageCount: b._count.messages,
    }));

    return NextResponse.json({
      summary: {
        total: bookings.length,
        pending: bookings.filter((b) => b.status === "PENDING").length,
        approved: bookings.filter((b) => b.status === "APPROVED").length,
        paid: bookings.filter((b) => b.paymentTransactionId).length,
      },
      pipeline,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load deal pipeline.");
    return NextResponse.json({ error: message }, { status });
  }
}
