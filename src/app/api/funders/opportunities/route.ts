import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canCreateListings, requireSessionUser } from "@/lib/funders";
import { FUNDING_MARKET_CATEGORIES } from "@/lib/funder-markets";

export async function GET(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;

  const market = req.nextUrl.searchParams.get("market");
  const status = req.nextUrl.searchParams.get("status") ?? "OPEN";
  const where = {
    visible: true,
    ...(status ? { status } : {}),
    ...(market ? { marketCategory: market } : {}),
  };

  const opportunities = await prisma.investmentOpportunity.findMany({
    where,
    include: {
      project: { select: { id: true, title: true, logline: true, budget: true, status: true } },
      createdByUser: { select: { id: true, name: true, professionalName: true, role: true } },
      companyListing: true,
      deals: {
        select: { id: true, pipelineStatus: true, funderUserId: true, submittedAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ opportunities });
}

export async function POST(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (!canCreateListings(access.role!)) {
    return NextResponse.json({ error: "Only creator/company roles can list opportunities." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        projectId?: string | null;
        type?: string;
        marketCategory?: string;
        title?: string;
        description?: string | null;
        fundingTarget?: number;
        minTicketSize?: number | null;
        maxTicketSize?: number | null;
        equityOfferedPct?: number | null;
        revenueModel?: string | null;
        termsSummary?: string | null;
        companyListing?: {
          companyName?: string;
          sector?: string | null;
          useOfFunds?: string | null;
          expansionObjective?: string | null;
          currentTraction?: string | null;
          capitalAssetPlan?: string | null;
        };
      }
    | null;

  if (!body?.title || !body.marketCategory || !FUNDING_MARKET_CATEGORIES.includes(body.marketCategory as never)) {
    return NextResponse.json({ error: "Title and a valid market category are required." }, { status: 400 });
  }
  const fundingTarget = Number(body.fundingTarget ?? 0);
  if (!Number.isFinite(fundingTarget) || fundingTarget <= 0) {
    return NextResponse.json({ error: "Funding target must be greater than 0." }, { status: 400 });
  }

  const opportunity = await prisma.investmentOpportunity.create({
    data: {
      projectId: body.projectId ?? null,
      createdByUserId: access.userId!,
      type: body.type ?? body.marketCategory,
      marketCategory: body.marketCategory,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      fundingTarget,
      minTicketSize: body.minTicketSize ?? null,
      maxTicketSize: body.maxTicketSize ?? null,
      equityOfferedPct: body.equityOfferedPct ?? null,
      revenueModel: body.revenueModel?.trim() || null,
      termsSummary: body.termsSummary?.trim() || null,
      status: "OPEN",
      visible: true,
      companyListing: body.companyListing?.companyName
        ? {
            create: {
              ownerUserId: access.userId!,
              companyName: body.companyListing.companyName.trim(),
              sector: body.companyListing.sector?.trim() || null,
              useOfFunds: body.companyListing.useOfFunds?.trim() || null,
              expansionObjective: body.companyListing.expansionObjective?.trim() || null,
              currentTraction: body.companyListing.currentTraction?.trim() || null,
              capitalAssetPlan: body.companyListing.capitalAssetPlan?.trim() || null,
            },
          }
        : undefined,
    },
    include: { companyListing: true },
  });

  return NextResponse.json({ opportunity }, { status: 201 });
}
