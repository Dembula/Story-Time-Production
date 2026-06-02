import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";

export async function GET() {
  try {
    const auth = await requireCompanySession(["CATERING_COMPANY", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const company = await prisma.cateringCompany.findUnique({ where: { userId: auth.userId } });
    if (!company) return NextResponse.json({ error: "Create catering profile first" }, { status: 404 });

    const bookings = await prisma.cateringBooking.findMany({
      where: { cateringCompanyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        creator: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    const pipeline = bookings.map((b) => ({
      id: b.id,
      kind: "CATERING_BOOKING" as const,
      title: `Event · ${b.headCount ?? "?"} guests`,
      subtitle: [b.eventDate, b.creator?.name].filter(Boolean).join(" · "),
      status: b.status,
      previewImageUrl: company.logoUrl,
      createdAt: b.createdAt.toISOString(),
      href: `/catering-company/bookings`,
      paid: Boolean(b.paymentTransactionId),
      messageCount: b._count.messages,
    }));

    return NextResponse.json({
      summary: {
        total: bookings.length,
        pending: bookings.filter((b) => b.status === "PENDING").length,
        paid: bookings.filter((b) => b.paymentTransactionId).length,
      },
      pipeline,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load deal pipeline.");
    return NextResponse.json({ error: message }, { status });
  }
}
