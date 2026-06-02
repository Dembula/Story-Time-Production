import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";

export async function GET() {
  try {
    const auth = await requireCompanySession(["EQUIPMENT_COMPANY", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const requests = await prisma.equipmentRequest.findMany({
      where: { companyId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        equipment: { select: { id: true, companyName: true, category: true, imageUrl: true } },
        requester: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    const pipeline = requests.map((r) => ({
      id: r.id,
      kind: "RENTAL_REQUEST" as const,
      title: r.equipment.companyName,
      subtitle: [r.equipment.category, r.requester?.name].filter(Boolean).join(" · "),
      status: r.status,
      previewImageUrl: r.equipment.imageUrl,
      createdAt: r.createdAt.toISOString(),
      href: `/equipment-company/requests`,
      paid: Boolean(r.paymentTransactionId),
      messageCount: r._count.messages,
    }));

    return NextResponse.json({
      summary: {
        total: requests.length,
        pending: requests.filter((r) => r.status === "PENDING").length,
        approved: requests.filter((r) => r.status === "APPROVED").length,
        paid: requests.filter((r) => r.paymentTransactionId).length,
      },
      pipeline,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load deal pipeline.");
    return NextResponse.json({ error: message }, { status });
  }
}
