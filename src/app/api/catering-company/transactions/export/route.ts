import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPayeeCompletedTransactionsForExport, MARKETPLACE_TRANSACTION_TYPE } from "@/lib/financial-ledger";
import { completedMarketplaceTransactionsCsv } from "@/lib/marketplace-export-csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "CATERING_COMPANY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await listPayeeCompletedTransactionsForExport(user.id, MARKETPLACE_TRANSACTION_TYPE.CATERING_BOOKING);
  const csv = completedMarketplaceTransactionsCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catering-transactions.csv"',
    },
  });
}
