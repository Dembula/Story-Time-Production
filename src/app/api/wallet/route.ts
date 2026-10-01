import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureWalletForUser, getWalletSnapshot } from "@/lib/payments/wallet";
import { maskPayoutBanking, resolvePayoutBankingForUser } from "@/lib/payments/payout-banking";
import { assertPayoutKycApproved, requiresPayoutKyc } from "@/lib/payout-kyc";
import { assertFunderVerificationApproved } from "@/lib/funder-verification";

const db = prisma as any;

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "SUBSCRIBER") return NextResponse.json({ error: "Wallet UI unavailable for viewers." }, { status: 403 });

  try {
    await ensureWalletForUser(user.id);
    const trackingEnabled = await (async () => {
      if (user.role !== "CONTENT_CREATOR" && user.role !== "MUSIC_CREATOR") return true;
      const { isCreatorRevenueTrackingEnabled } = await import("@/lib/finance/revenue-connector");
      return isCreatorRevenueTrackingEnabled();
    })();

    const wallet = await getWalletSnapshot(user.id);
    const transactions = trackingEnabled
      ? await db.ledgerEntry.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];
    const escrows = trackingEnabled
      ? await db.escrowAccount.findMany({
          where: {
            OR: [{ buyerWalletId: wallet?.id }, { sellerWalletId: wallet?.id }],
          },
          include: {
            buyerWallet: { select: { userId: true } },
            sellerWallet: { select: { userId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : [];

    const payoutBanking = await resolvePayoutBankingForUser(user.id, user.role);

    const maskedWallet =
      trackingEnabled || !wallet
        ? wallet
        : {
            ...wallet,
            availableBalance: 0,
            pendingBalance: 0,
            lockedBalance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            autoPayoutEnabled: false,
            accounts: (wallet.accounts ?? []).map((account: { accountType: string; balance: number }) => ({
              ...account,
              balance:
                account.accountType === "AVAILABLE" ||
                account.accountType === "PENDING" ||
                account.accountType === "LOCKED"
                  ? 0
                  : account.balance,
            })),
          };

    return NextResponse.json({
      wallet: maskedWallet,
      transactions,
      escrows,
      payoutBanking: payoutBanking ? maskPayoutBanking(payoutBanking) : null,
      revenueTrackingPaused: !trackingEnabled,
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return NextResponse.json({
        wallet: null,
        transactions: [],
        escrows: [],
        migrationRequired: true,
        message: "Wallet infrastructure not yet migrated in this environment. Run prisma migrate deploy.",
      });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "SUBSCRIBER") {
    return NextResponse.json({ error: "Wallet UI unavailable for viewers." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        filters?: { type?: string; status?: string; from?: string; to?: string };
        autoPayoutEnabled?: boolean;
      }
    | null;

  if (typeof body?.autoPayoutEnabled === "boolean") {
    const isCreator = user.role === "CONTENT_CREATOR" || user.role === "MUSIC_CREATOR";
    if (!isCreator) {
      return NextResponse.json(
        { error: "Auto payout is only available for creator wallets." },
        { status: 403 },
      );
    }

    if (body.autoPayoutEnabled) {
      const { isCreatorRevenueTrackingEnabled } = await import("@/lib/finance/revenue-connector");
      if (!(await isCreatorRevenueTrackingEnabled())) {
        return NextResponse.json(
          {
            error: "Auto payout is unavailable while platform revenue tracking is offline.",
            code: "REVENUE_TRACKING_PAUSED",
          },
          { status: 403 },
        );
      }
      if (requiresPayoutKyc(user.role)) {
        const kycCheck = await assertPayoutKycApproved(user.id);
        if (!kycCheck.ok) {
          return NextResponse.json(
            { error: kycCheck.error, code: "PAYOUT_KYC_REQUIRED" },
            { status: 403 },
          );
        }
      }
      if (user.role === "FUNDER") {
        const funderCheck = await assertFunderVerificationApproved(user.id);
        if (!funderCheck.ok) {
          return NextResponse.json({ error: funderCheck.error, code: funderCheck.code }, { status: 403 });
        }
      }
      const banking = await resolvePayoutBankingForUser(user.id, user.role);
      if (!banking) {
        return NextResponse.json(
          {
            error: "Add verified bank details before enabling auto payout.",
            code: "PAYOUT_BANKING_REQUIRED",
          },
          { status: 400 },
        );
      }
    }

    await ensureWalletForUser(user.id);
    const wallet = await db.wallet.update({
      where: { userId: user.id },
      data: {
        autoPayoutEnabled: body.autoPayoutEnabled,
        autoPayoutUpdatedAt: new Date(),
      },
      include: {
        accounts: true,
        payoutRequests: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    return NextResponse.json({
      ok: true,
      wallet,
      autoPayoutEnabled: wallet.autoPayoutEnabled,
    });
  }

  const where: Record<string, unknown> = { userId: user.id };
  if (body?.filters?.type) where.transactionType = body.filters.type;
  if (body?.filters?.status) where.status = body.filters.status;
  if (body?.filters?.from || body?.filters?.to) {
    where.createdAt = {
      ...(body.filters.from ? { gte: new Date(body.filters.from) } : {}),
      ...(body.filters.to ? { lte: new Date(body.filters.to) } : {}),
    };
  }
  try {
    const transactions = await db.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ transactions });
  } catch (error: any) {
    if (error?.code === "P2021") {
      return NextResponse.json({
        transactions: [],
        migrationRequired: true,
        message: "Wallet infrastructure not yet migrated in this environment. Run prisma migrate deploy.",
      });
    }
    throw error;
  }
}
