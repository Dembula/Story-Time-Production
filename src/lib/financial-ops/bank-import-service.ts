import { prisma } from "@/lib/prisma";
import { detectDuplicateCandidates, parseExpenseRow } from "@/lib/expense-service";

export type BankCsvRow = {
  date: string;
  description?: string;
  amount: number;
  reference?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseBankCsv(text: string): BankCsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const dateIdx = header.findIndex((h) => h.includes("date"));
  const descIdx = header.findIndex((h) => h.includes("desc") || h.includes("narrative") || h.includes("memo"));
  const amtIdx = header.findIndex((h) => h.includes("amount") || h.includes("debit") || h.includes("credit"));
  const refIdx = header.findIndex((h) => h.includes("ref"));

  const rows: BankCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const amountRaw = amtIdx >= 0 ? cols[amtIdx]?.replace(/[^\d.-]/g, "") : cols[cols.length - 1]?.replace(/[^\d.-]/g, "");
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount)) continue;
    rows.push({
      date: dateIdx >= 0 ? cols[dateIdx] ?? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: descIdx >= 0 ? cols[descIdx] : cols[1],
      amount: Math.abs(amount),
      reference: refIdx >= 0 ? cols[refIdx] : undefined,
    });
  }
  return rows;
}

export async function importBankStatement(input: {
  projectId: string;
  userId: string;
  csvText: string;
  fileName?: string;
}) {
  const rows = parseBankCsv(input.csvText);
  const batch = await prisma.bankImportBatch.create({
    data: {
      projectId: input.projectId,
      source: "CSV",
      fileName: input.fileName ?? "import.csv",
      importedById: input.userId,
      rowCount: rows.length,
      status: "IMPORTED",
    },
  });

  const expenses = await prisma.productionExpense.findMany({
    where: { projectId: input.projectId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  const parsedExpenses = expenses.map(parseExpenseRow);

  let matched = 0;
  for (const row of rows) {
    const spentAt = new Date(row.date);
    const dupes = detectDuplicateCandidates(parsedExpenses, {
      amount: row.amount,
      vendor: row.description ?? null,
      spentAt,
    });
    const expenseId = dupes[0]?.id ?? null;
    if (expenseId) matched++;

    await prisma.bankTransaction.create({
      data: {
        batchId: batch.id,
        projectId: input.projectId,
        transactionDate: spentAt,
        description: row.description ?? null,
        amount: row.amount,
        reference: row.reference ?? null,
        matchStatus: expenseId ? "MATCHED" : "UNMATCHED",
        expenseId,
      },
    });
  }

  await prisma.bankImportBatch.update({
    where: { id: batch.id },
    data: { matchedCount: matched },
  });

  return { batchId: batch.id, rowCount: rows.length, matchedCount: matched };
}

export async function listBankImports(projectId: string) {
  return prisma.bankImportBatch.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      transactions: { orderBy: { transactionDate: "desc" }, take: 50 },
      importedBy: { select: { id: true, name: true } },
    },
  });
}

export async function matchBankTransaction(transactionId: string, expenseId: string) {
  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: { expenseId, matchStatus: "MATCHED" },
  });
}
