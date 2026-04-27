import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getLocationOwnerFinancialSnapshot,
  listPayeeCompletedTransactionsForExport,
  MARKETPLACE_TRANSACTION_TYPE,
} from "@/lib/financial-ledger";
import { completedMarketplaceTransactionsCsv } from "@/lib/marketplace-export-csv";
import { rowsToCsv } from "@/lib/csv-export";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || (session.user as { role?: string }).role !== "LOCATION_OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getLocationOwnerFinancialSnapshot(user.id);
  const txs = await listPayeeCompletedTransactionsForExport(user.id, MARKETPLACE_TRANSACTION_TYPE.LOCATION_BOOKING);

  const summary = rowsToCsv(
    ["settledRevenueZar", "pipelineEstimateZar", "settledTransactionCount", "approvedAwaitingPaymentCount"],
    [
      [
        snapshot.settledRevenue,
        snapshot.pipelineEstimate,
        snapshot.settledTransactionCount,
        snapshot.approvedAwaitingPaymentCount,
      ],
    ],
  );

  const csv = [
    `# location_owner=${user.id}`,
    `# settledWindow=${snapshot.reporting.settledWindow}`,
    "",
    "# summary",
    summary,
    "",
    "# transactions",
    completedMarketplaceTransactionsCsv(txs),
  ].join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="location-financials.csv"',
    },
  });
}
