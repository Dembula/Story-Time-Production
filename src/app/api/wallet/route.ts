import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureWalletForUser, getWalletSnapshot } from "@/lib/payments/wallet";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";
import { maskPayoutBanking, resolvePayoutBankingForUser } from "@/lib/payments/payout-banking";
const db = prisma as any;

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "SUBSCRIBER") return NextResponse.json({ error: "Wallet UI unavailable for viewers." }, { status: 403 });

  try {
    await ensureWalletForUser(user.id);
    const wallet = await getWalletSnapshot(user.id);
    const transactions = await db.ledgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const escrows = await db.escrowAccount.findMany({
      where: {
        OR: [{ buyerWalletId: wallet?.id }, { sellerWalletId: wallet?.id }],
      },
      include: {
        buyerWallet: { select: { userId: true } },
        sellerWallet: { select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const [payfastToken, payoutBanking] = await Promise.all([
      getPayFastTokenForUser(user.id),
      resolvePayoutBankingForUser(user.id, user.role),
    ]);

    return NextResponse.json({
      wallet,
      transactions,
      escrows,
      payfastCard: {
        hasToken: Boolean(payfastToken),
        source: payfastToken?.source ?? null,
      },
      payoutBanking: payoutBanking ? maskPayoutBanking(payoutBanking) : null,
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
  const body = (await req.json().catch(() => null)) as
    | { filters?: { type?: string; status?: string; from?: string; to?: string } }
    | null;

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
