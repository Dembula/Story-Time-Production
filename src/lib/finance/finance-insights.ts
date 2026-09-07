import "server-only";

import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";
import { paymentPurposeLabel } from "@/lib/admin/payment-transaction-detail.types";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";

export type PromoLiabilityBundle = {
  redemptionCount: number;
  totalDiscountZar: number;
  freeYearCount: number;
  byCode: Array<{
    code: string;
    kind: string;
    target: string;
    active: boolean;
    redemptionCount: number;
    discountZar: number;
    maxRedemptions: number | null;
  }>;
  byContext: Array<{ context: string; count: number; discountZar: number }>;
  recent: Array<{
    id: string;
    code: string;
    kind: string;
    context: string;
    discountAmount: number;
    resultingPlan: string | null;
    redeemedAt: string;
    user: { id: string; name: string | null; email: string | null };
  }>;
  insight: {
    discountAsPctOfGross: number | null;
    note: string;
  };
};

export type FundingMoneyBundle = {
  programsActive: number;
  applications: {
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
    requestedZar: number;
    approvedRequestedZar: number;
  };
  projectFundingRequests: {
    pending: number;
    approved: number;
    requestedZar: number;
  };
  deals: {
    total: number;
    funded: number;
    negotiating: number;
    termSheetCommittedZar: number;
  };
  dealPayments: {
    pendingZar: number;
    settledZar: number;
    settledCount: number;
    recent: Array<{
      id: string;
      amount: number;
      status: string;
      currency: string;
      settledAt: string | null;
      createdAt: string;
      funder: { id: string; name: string | null; email: string | null };
      creator: { id: string; name: string | null; email: string | null };
      projectTitle: string | null;
    }>;
  };
  funders: {
    approved: number;
    pending: number;
    rejected: number;
  };
};

export type RetentionBreakdownBundle = {
  viewerPlatformRetained: number;
  marketplaceFees: number;
  serviceRevenueNet: number;
  platformTotalRetained: number;
  byPurpose: Array<{
    purpose: string;
    purposeLabel: string;
    count: number;
    gross: number;
    gatewayFees: number;
    net: number;
    platformShare: number;
    creatorShare: number;
    category: "viewer_pool" | "marketplace_service" | "platform_service";
  }>;
  escrow: {
    heldCount: number;
    heldZar: number;
    releasedInPeriodZar: number;
    refundedInPeriodZar: number;
  };
  treasury: {
    platformRevenueBalance: number;
    creatorRevenueBalance: number;
    walletsAvailable: number;
    walletsPending: number;
    walletsLocked: number;
  };
};

export async function fetchPromoLiability(
  periodStart: Date,
  periodEnd: Date,
  periodGrossCash: number,
): Promise<PromoLiabilityBundle> {
  const redemptions = await prisma.promoCodeRedemption.findMany({
    where: { redeemedAt: { gte: periodStart, lte: periodEnd } },
    include: {
      promoCode: { select: { code: true, kind: true, target: true, active: true, maxRedemptions: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { redeemedAt: "desc" },
  });

  let totalDiscountZar = 0;
  let freeYearCount = 0;
  const byCodeMap = new Map<
    string,
    {
      code: string;
      kind: string;
      target: string;
      active: boolean;
      redemptionCount: number;
      discountZar: number;
      maxRedemptions: number | null;
    }
  >();
  const byContextMap = new Map<string, { context: string; count: number; discountZar: number }>();

  for (const r of redemptions) {
    const discount = roundMoney(Number(r.discountAmount ?? 0));
    totalDiscountZar = roundMoney(totalDiscountZar + discount);
    if (r.promoCode.kind === "FREE_YEAR_SUBSCRIPTION") freeYearCount += 1;

    const codeKey = r.promoCode.code;
    const codeRow = byCodeMap.get(codeKey) ?? {
      code: r.promoCode.code,
      kind: r.promoCode.kind,
      target: r.promoCode.target,
      active: r.promoCode.active,
      redemptionCount: 0,
      discountZar: 0,
      maxRedemptions: r.promoCode.maxRedemptions,
    };
    codeRow.redemptionCount += 1;
    codeRow.discountZar = roundMoney(codeRow.discountZar + discount);
    byCodeMap.set(codeKey, codeRow);

    const ctx = byContextMap.get(r.context) ?? { context: r.context, count: 0, discountZar: 0 };
    ctx.count += 1;
    ctx.discountZar = roundMoney(ctx.discountZar + discount);
    byContextMap.set(r.context, ctx);
  }

  const discountAsPctOfGross =
    periodGrossCash > 0 ? roundMoney((totalDiscountZar / periodGrossCash) * 10000) / 100 : null;

  return {
    redemptionCount: redemptions.length,
    totalDiscountZar,
    freeYearCount,
    byCode: [...byCodeMap.values()].sort((a, b) => b.discountZar - a.discountZar),
    byContext: [...byContextMap.values()].sort((a, b) => b.discountZar - a.discountZar),
    recent: redemptions.slice(0, 50).map((r) => ({
      id: r.id,
      code: r.promoCode.code,
      kind: r.promoCode.kind,
      context: r.context,
      discountAmount: roundMoney(Number(r.discountAmount ?? 0)),
      resultingPlan: r.resultingPlan,
      redeemedAt: r.redeemedAt.toISOString(),
      user: r.user,
    })),
    insight: {
      discountAsPctOfGross,
      note:
        discountAsPctOfGross == null
          ? "No cash gross in period — promo liability is absolute forgone list-price value."
          : discountAsPctOfGross >= 15
            ? "Promo discounts are ≥15% of cash gross — review whether acquisition cost is justified."
            : discountAsPctOfGross >= 8
              ? "Moderate promo spend relative to cash gross — monitor trend month over month."
              : "Promo liability is modest relative to cash gross for this period.",
    },
  };
}

export async function fetchFundingMoney(periodStart: Date, periodEnd: Date): Promise<FundingMoneyBundle> {
  const [programsActive, apps, projectReqs, deals, termSheets, dealPayments, funders] = await Promise.all([
    prisma.fundingProgram.count({ where: { status: "ACTIVE" } }),
    prisma.fundingProgramApplication.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      select: { status: true, requestedAmount: true },
    }),
    prisma.fundingRequest.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      select: { status: true, amount: true },
    }),
    prisma.investmentDeal.findMany({
      where: {
        OR: [
          { createdAt: { gte: periodStart, lte: periodEnd } },
          { closedAt: { gte: periodStart, lte: periodEnd } },
          { updatedAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
      select: { pipelineStatus: true },
    }),
    prisma.dealTermSheet.findMany({
      where: {
        status: "AGREED",
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: { investmentAmount: true },
    }),
    prisma.dealPayment.findMany({
      where: {
        OR: [
          { createdAt: { gte: periodStart, lte: periodEnd } },
          { settledAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
      include: {
        deal: {
          include: {
            funderUser: { select: { id: true, name: true, email: true } },
            creatorUser: { select: { id: true, name: true, email: true } },
            project: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.funderProfile.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
  ]);

  const applications = {
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    requestedZar: 0,
    approvedRequestedZar: 0,
  };
  for (const a of apps) {
    const amt = roundMoney(Number(a.requestedAmount ?? 0));
    applications.requestedZar = roundMoney(applications.requestedZar + amt);
    if (a.status === "SUBMITTED") applications.submitted += 1;
    else if (a.status === "UNDER_REVIEW" || a.status === "CHANGES_REQUESTED") applications.underReview += 1;
    else if (a.status === "APPROVED") {
      applications.approved += 1;
      applications.approvedRequestedZar = roundMoney(applications.approvedRequestedZar + amt);
    } else if (a.status === "REJECTED") applications.rejected += 1;
  }

  const projectFundingRequests = { pending: 0, approved: 0, requestedZar: 0 };
  for (const r of projectReqs) {
    projectFundingRequests.requestedZar = roundMoney(
      projectFundingRequests.requestedZar + roundMoney(Number(r.amount ?? 0)),
    );
    if (r.status === "PENDING") projectFundingRequests.pending += 1;
    if (r.status === "APPROVED") projectFundingRequests.approved += 1;
  }

  let funded = 0;
  let negotiating = 0;
  for (const d of deals) {
    if (d.pipelineStatus === "FUNDED") funded += 1;
    if (["INTERESTED", "NEGOTIATING", "CONTRACT_PENDING", "SIGNING"].includes(d.pipelineStatus)) {
      negotiating += 1;
    }
  }

  const termSheetCommittedZar = roundMoney(
    termSheets.reduce((acc, t) => acc + Number(t.investmentAmount || 0), 0),
  );

  let pendingZar = 0;
  let settledZar = 0;
  let settledCount = 0;
  for (const p of dealPayments) {
    const amt = roundMoney(Number(p.amount || 0));
    if (p.status === "SETTLED") {
      settledZar = roundMoney(settledZar + amt);
      settledCount += 1;
    } else if (["PENDING", "LOCKED", "AUTHORIZED"].includes(p.status)) {
      pendingZar = roundMoney(pendingZar + amt);
    }
  }

  const funderCounts = { approved: 0, pending: 0, rejected: 0 };
  for (const f of funders) {
    if (f.verificationStatus === "APPROVED") funderCounts.approved = f._count._all;
    else if (f.verificationStatus === "REJECTED") funderCounts.rejected = f._count._all;
    else funderCounts.pending += f._count._all;
  }

  return {
    programsActive,
    applications,
    projectFundingRequests,
    deals: {
      total: deals.length,
      funded,
      negotiating,
      termSheetCommittedZar,
    },
    dealPayments: {
      pendingZar,
      settledZar,
      settledCount,
      recent: dealPayments.slice(0, 40).map((p) => ({
        id: p.id,
        amount: roundMoney(Number(p.amount || 0)),
        status: p.status,
        currency: p.currency || "ZAR",
        settledAt: p.settledAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        funder: p.deal.funderUser,
        creator: p.deal.creatorUser,
        projectTitle: p.deal.project?.title ?? null,
      })),
    },
    funders: funderCounts,
  };
}

export function categorizePaymentPurpose(
  purpose: string,
): RetentionBreakdownBundle["byPurpose"][number]["category"] {
  if (isViewerPoolPaymentPurpose(purpose)) return "viewer_pool";
  const p = purpose || "";
  if (
    p.includes("EQUIPMENT") ||
    p.includes("LOCATION") ||
    p.includes("CATERING") ||
    p.includes("CREW") ||
    p.includes("CAST") ||
    p.includes("CONTRACT_HIRE") ||
    p.includes("AUDITION") ||
    p.includes("CASTING")
  ) {
    return "marketplace_service";
  }
  return "platform_service";
}

export async function fetchEscrowAndTreasury(
  periodStart: Date,
  periodEnd: Date,
): Promise<Pick<RetentionBreakdownBundle, "escrow" | "treasury">> {
  const [held, released, refunded, accounts] = await Promise.all([
    prisma.escrowAccount.aggregate({
      where: { status: "HELD" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.escrowAccount.aggregate({
      where: { status: "RELEASED", releasedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    prisma.escrowAccount.aggregate({
      where: { status: "REFUNDED", updatedAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    }),
    prisma.walletAccount.groupBy({
      by: ["accountType"],
      _sum: { balance: true },
    }),
  ]);

  const bal = (type: string) =>
    roundMoney(Number(accounts.find((a) => a.accountType === type)?._sum.balance ?? 0));

  return {
    escrow: {
      heldCount: held._count._all ?? 0,
      heldZar: roundMoney(Number(held._sum.amount ?? 0)),
      releasedInPeriodZar: roundMoney(Number(released._sum.amount ?? 0)),
      refundedInPeriodZar: roundMoney(Number(refunded._sum.amount ?? 0)),
    },
    treasury: {
      platformRevenueBalance: bal("PLATFORM_REVENUE"),
      creatorRevenueBalance: bal("CREATOR_REVENUE"),
      walletsAvailable: bal("AVAILABLE"),
      walletsPending: bal("PENDING"),
      walletsLocked: bal("LOCKED"),
    },
  };
}

export { paymentPurposeLabel };
