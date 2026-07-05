import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { splitViewerRevenue } from "@/lib/payments/fees";
import { getPaymentSettlementAmount } from "@/lib/payments/payfast-settlement";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { getWalletSnapshot } from "@/lib/payments/wallet";
import { VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT } from "@/lib/payments/config";
import { isViewerPoolPaymentPurpose } from "@/lib/payments/viewer-pool-purposes";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";

const db = prisma as any;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { adminId: null as string | null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: user.id, error: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? "100"));
  try {
    const [paymentRecords, transactions, payouts, escrows, gatewayEvents, invoices] = await Promise.all([
      db.paymentRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      db.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          payer: { select: { id: true, name: true, email: true, role: true } },
          payee: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      db.payoutRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              creatorBanking: {
                select: {
                  bankName: true,
                  accountNumber: true,
                  accountType: true,
                  branchCode: true,
                  verifiedAt: true,
                },
              },
              payoutKycProfile: {
                select: { kycData: true, verificationStatus: true, legalName: true },
              },
            },
          },
        },
      }),
      db.escrowAccount.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.gatewayEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.invoice.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    ]);
    const paymentRecordsTyped = paymentRecords as any[];
    const transactionsTyped = transactions as any[];
    const payoutsTyped = payouts as any[];
    const escrowsTyped = escrows as any[];
    const invoicesTyped = invoices as any[];

    const succeededPayments = paymentRecordsTyped.filter((p: any) => p.status === "SUCCEEDED");
    const grossInflow = succeededPayments.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const netInflow = succeededPayments.reduce(
      (sum: number, p: any) =>
        sum +
        getPaymentSettlementAmount({
          amount: Number(p.amount ?? 0),
          settlementAmount: p.settlementAmount != null ? Number(p.settlementAmount) : null,
        }),
      0,
    );
    const payfastFeesTotal = succeededPayments.reduce(
      (sum: number, p: any) => sum + Number(p.providerFeeAmount ?? 0),
      0,
    );

    const viewerPoolPayments = succeededPayments.filter((p: any) => isViewerPoolPaymentPurpose(p.purpose));
    const viewerSubGross = viewerPoolPayments.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const viewerSubNet = viewerPoolPayments.reduce(
      (sum: number, p: any) =>
        sum +
        getPaymentSettlementAmount({
          amount: Number(p.amount ?? 0),
          settlementAmount: p.settlementAmount != null ? Number(p.settlementAmount) : null,
        }),
      0,
    );
    const viewerSplit = splitViewerRevenue(viewerSubNet);

    const marketplaceFees = transactionsTyped
      .filter((t: any) => t.status === "COMPLETED")
      .reduce((sum: number, t: any) => sum + Number(t.feeAmount ?? 0), 0);

    const platformServiceRevenue = succeededPayments
      .filter((p: any) =>
        ["SCRIPT_REVIEW", "CASTING_ACQUISITION_FEE", "AUDITION_LISTING", "CREATOR_", "COMPANY_"].some((prefix) =>
          String(p.purpose ?? "").startsWith(prefix),
        ),
      )
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);

    const platformCharges = marketplaceFees + viewerSplit.platform + platformServiceRevenue;

    const payoutPaidTotal = payoutsTyped
      .filter((p: any) => p.status === "PAID" || p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const payoutPendingReview = payoutsTyped.filter((p: any) =>
      ["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(p.status),
    ).length;
    const payoutProcessingTotal = payoutsTyped
      .filter((p: any) => ["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(p.status))
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);

    const treasuryUserId = await getPlatformTreasuryUserId();
    const platformWallet = await getWalletSnapshot(treasuryUserId);
    const accountByType = new Map<string, any>(
      (platformWallet?.accounts ?? []).map((a: any) => [String(a.accountType), a]),
    );

    const treasuryAvailable = Number(platformWallet?.availableBalance ?? 0);
    const creatorPoolHeld = Number(accountByType.get("CREATOR_REVENUE")?.balance ?? 0);
    const platformRevenueRecognized = Number(accountByType.get("PLATFORM_REVENUE")?.balance ?? 0);
    const netRetained = treasuryAvailable + creatorPoolHeld + platformRevenueRecognized;

    const metrics = {
      paymentPending: paymentRecordsTyped.filter((p: any) => p.status === "PENDING").length,
      paymentSucceeded: succeededPayments.length,
      txPending: transactionsTyped.filter((t: any) => t.status === "PENDING").length,
      txCompleted: transactionsTyped.filter((t: any) => t.status === "COMPLETED").length,
      escrowHeld: escrowsTyped.filter((e: any) => e.status === "HELD").length,
      escrowDisputed: escrowsTyped.filter((e: any) => e.status === "DISPUTED").length,
      payoutProcessing: payoutPendingReview,
      payoutFailed: payoutsTyped.filter((p: any) => p.status === "FAILED" || p.status === "DECLINED").length,
      grossInflow,
      netInflow,
      payfastFeesTotal,
      platformCharges,
      marketplaceFees,
      viewerSubGross,
      viewerSubNet,
      viewerCreatorPool: viewerSplit.creator,
      viewerPlatformShare: viewerSplit.platform,
      platformServiceRevenue,
      netRetained,
      payoutCompletedTotal: payoutPaidTotal,
      payoutProcessingTotal,
      platformAvailableBalance: treasuryAvailable,
      platformPendingBalance: Number(platformWallet?.pendingBalance ?? 0),
      platformLockedBalance: Number(platformWallet?.lockedBalance ?? 0),
      platformRevenueAccountBalance: platformRevenueRecognized,
      creatorPoolHeld,
      viewerCreatorSplitPct: VIEWER_CREATOR_SPLIT * 100,
      viewerPlatformSplitPct: VIEWER_PLATFORM_SPLIT * 100,
    };

    const trialSubscriptions = await db.viewerSubscription.findMany({
      where: {
        viewerModel: "SUBSCRIPTION",
        OR: [{ status: "TRIAL_ACTIVE" }, { trialEndsAt: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const trialSignups = trialSubscriptions.map((sub: any) => {
      const planConfig = VIEWER_PLAN_CONFIG[sub.plan as keyof typeof VIEWER_PLAN_CONFIG] ?? VIEWER_PLAN_CONFIG.BASE_1;
      const isActiveTrial = sub.status === "TRIAL_ACTIVE";
      return {
        id: sub.id,
        userId: sub.userId,
        userName: sub.user?.name ?? null,
        userEmail: sub.user?.email ?? null,
        plan: sub.plan,
        planLabel: planConfig.label,
        potentialMonthlyRevenue: planConfig.price,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        createdAt: sub.createdAt,
        isActiveTrial,
        hasConverted: sub.lastPaymentStatus === "SUCCEEDED",
      };
    });

    const trialMetrics = {
      activeTrialCount: trialSignups.filter((row: { isActiveTrial: boolean }) => row.isActiveTrial).length,
      potentialMonthlyRevenue: trialSignups
        .filter((row: { isActiveTrial: boolean }) => row.isActiveTrial)
        .reduce((sum: number, row: { potentialMonthlyRevenue: number }) => sum + row.potentialMonthlyRevenue, 0),
      totalTrialSignups: trialSignups.length,
    };

    return NextResponse.json({
      metrics: { ...metrics, ...trialMetrics },
      paymentRecords,
      transactions,
      payouts,
      escrows,
      gatewayEvents,
      invoices,
      trialSignups,
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return NextResponse.json({
        migrationRequired: true,
        message: "Payments tables are not migrated in this environment. Run prisma migrate deploy.",
        metrics: {},
        paymentRecords: [],
        transactions: [],
        payouts: [],
        escrows: [],
        gatewayEvents: [],
        invoices: [],
      });
    }
    throw error;
  }
}
