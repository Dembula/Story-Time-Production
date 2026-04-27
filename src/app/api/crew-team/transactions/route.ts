import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPayeeCompletedTransactions, MARKETPLACE_TRANSACTION_TYPE } from "@/lib/financial-ledger";
import { parseTakeSkip } from "@/lib/pagination-params";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CREW_TEAM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { take, skip } = parseTakeSkip(req.nextUrl.searchParams);
  const transactions = await listPayeeCompletedTransactions(user.id, MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST, {
    take,
    skip,
  });
  return NextResponse.json(transactions);
}
