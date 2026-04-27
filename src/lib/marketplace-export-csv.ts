import { rowsToCsv } from "@/lib/csv-export";

export function completedMarketplaceTransactionsCsv(
  rows: { id: string; amount: number; totalAmount: number; createdAt: Date }[],
): string {
  return rowsToCsv(
    ["id", "amountZar", "totalAmountZar", "createdAtIso"],
    rows.map((r) => [r.id, r.amount, r.totalAmount, r.createdAt.toISOString()]),
  );
}
