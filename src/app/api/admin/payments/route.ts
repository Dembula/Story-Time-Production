import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
      db.paymentRecord.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.transaction.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.payoutRequest.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.escrowAccount.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.gatewayEvent.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
      db.invoice.findMany({ orderBy: { createdAt: "desc" }, take: limit }),
    ]);
    const paymentRecordsTyped = paymentRecords as any[];
    const transactionsTyped = transactions as any[];
    const payoutsTyped = payouts as any[];
    const escrowsTyped = escrows as any[];
    const invoicesTyped = invoices as any[];

    const grossInflow = paymentRecordsTyped
      .filter((p: any) => p.status === "SUCCEEDED")
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const platformCharges = invoicesTyped.reduce(
      (sum: number, inv: any) => sum + Number(inv.platformFeeAmount ?? 0),
      0,
    );
    const payoutCompletedTotal = payoutsTyped
      .filter((p: any) => p.status === "COMPLETED")
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const payoutProcessingTotal = payoutsTyped
      .filter((p: any) => p.status === "PROCESSING")
      .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
    const netRetained = grossInflow - payoutCompletedTotal;

    const adminUser = await db.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    const platformWallet =
      adminUser?.id
        ? await db.wallet.findUnique({
            where: { userId: adminUser.id },
            include: { accounts: true },
          })
        : null;
    const accountByType = new Map<string, any>(
      (platformWallet?.accounts ?? []).map((a: any) => [String(a.accountType), a]),
    );

    const metrics = {
      paymentPending: paymentRecordsTyped.filter((p: any) => p.status === "PENDING").length,
      paymentSucceeded: paymentRecordsTyped.filter((p: any) => p.status === "SUCCEEDED").length,
      txPending: transactionsTyped.filter((t: any) => t.status === "PENDING").length,
      txCompleted: transactionsTyped.filter((t: any) => t.status === "COMPLETED").length,
      escrowHeld: escrowsTyped.filter((e: any) => e.status === "HELD").length,
      escrowDisputed: escrowsTyped.filter((e: any) => e.status === "DISPUTED").length,
      payoutProcessing: payoutsTyped.filter((p: any) => p.status === "PROCESSING").length,
      payoutFailed: payoutsTyped.filter((p: any) => p.status === "FAILED").length,
      grossInflow,
      platformCharges,
      netRetained,
      payoutCompletedTotal,
      payoutProcessingTotal,
      platformAvailableBalance: Number(platformWallet?.availableBalance ?? 0),
      platformPendingBalance: Number(platformWallet?.pendingBalance ?? 0),
      platformLockedBalance: Number(platformWallet?.lockedBalance ?? 0),
      platformRevenueAccountBalance: Number(accountByType.get("PLATFORM_REVENUE")?.balance ?? 0),
    };

    return NextResponse.json({
      metrics,
      paymentRecords,
      transactions,
      payouts,
      escrows,
      gatewayEvents,
      invoices,
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return NextResponse.json({
        migrationRequired: true,
        message: "Payments tables are not migrated in this environment. Run prisma migrate deploy.",
        metrics: {
          paymentPending: 0,
          paymentSucceeded: 0,
          txPending: 0,
          txCompleted: 0,
          escrowHeld: 0,
          escrowDisputed: 0,
          payoutProcessing: 0,
          payoutFailed: 0,
        },
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
