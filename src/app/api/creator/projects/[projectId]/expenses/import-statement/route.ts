import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess } from "@/lib/financial-ops-access";
import { importBankStatement, listBankImports, matchBankTransaction } from "@/lib/financial-ops/bank-import-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;
  const batches = await listBankImports(projectId);
  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error || !access.userId) return access.error;

  const body = await req.json().catch(() => ({}));

  if (body.action === "match") {
    const tx = await matchBankTransaction(body.transactionId, body.expenseId);
    return NextResponse.json({ transaction: tx });
  }

  if (!body.csvText?.trim()) {
    return NextResponse.json({ error: "csvText required" }, { status: 400 });
  }

  const result = await importBankStatement({
    projectId,
    userId: access.userId,
    csvText: body.csvText,
    fileName: body.fileName,
  });
  return NextResponse.json(result);
}
