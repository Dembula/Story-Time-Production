import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";
import { MARKETPLACE_TRANSACTION_TYPE, sumPayeeCompletedAmount } from "@/lib/financial-ledger";

export async function GET() {
  try {
    const auth = await requireCompanySession(["EQUIPMENT_COMPANY", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [listings, requests, revenue] = await Promise.all([
      prisma.equipmentListing.count({ where: { companyId: auth.userId } }),
      prisma.equipmentRequest.findMany({
        where: { companyId: auth.userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          equipment: { select: { companyName: true, category: true, imageUrl: true } },
          requester: { select: { name: true } },
        },
      }),
      sumPayeeCompletedAmount(auth.userId, MARKETPLACE_TRANSACTION_TYPE.EQUIPMENT_REQUEST),
    ]);

    const pending = requests.filter((r) => r.status === "PENDING").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;

    return NextResponse.json({
      metrics: {
        listings,
        totalRequests: requests.length,
        pending,
        approved,
        revenue,
      },
      recentRequests: requests,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load equipment overview.");
    return NextResponse.json({ error: message }, { status });
  }
}
