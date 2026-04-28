import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canCreateListings, requireSessionUser } from "@/lib/funders";

const COMPANY_ROLES = new Set([
  "EQUIPMENT_COMPANY",
  "LOCATION_OWNER",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "CATERING_COMPANY",
]);

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!canCreateListings(access.role!)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const listings = await prisma.companyFundingListing.findMany({
    where: { ownerUserId: access.userId! },
    include: { opportunity: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!COMPANY_ROLES.has(access.role!)) {
    return NextResponse.json({ error: "Only company role dashboards can create expansion listings." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        companyName?: string;
        title?: string;
        description?: string | null;
        fundingTarget?: number;
        sector?: string | null;
        useOfFunds?: string | null;
        expansionObjective?: string | null;
        currentTraction?: string | null;
        capitalAssetPlan?: string | null;
      }
    | null;
  if (!body?.companyName || !body?.title || !body?.fundingTarget) {
    return NextResponse.json({ error: "companyName, title and fundingTarget are required." }, { status: 400 });
  }

  const listing = await prisma.$transaction(async (tx) => {
    const opportunity = await tx.investmentOpportunity.create({
      data: {
        createdByUserId: access.userId!,
        type: "COMPANY_EXPANSION",
        marketCategory: "COMPANY_EXPANSION",
        title: body.title!.trim(),
        description: body.description?.trim() || null,
        fundingTarget: Number(body.fundingTarget),
        status: "OPEN",
      },
    });
    return tx.companyFundingListing.create({
      data: {
        ownerUserId: access.userId!,
        opportunityId: opportunity.id,
        companyName: body.companyName!.trim(),
        sector: body.sector?.trim() || null,
        useOfFunds: body.useOfFunds?.trim() || null,
        expansionObjective: body.expansionObjective?.trim() || null,
        currentTraction: body.currentTraction?.trim() || null,
        capitalAssetPlan: body.capitalAssetPlan?.trim() || null,
      },
      include: { opportunity: true },
    });
  });

  return NextResponse.json({ listing }, { status: 201 });
}
