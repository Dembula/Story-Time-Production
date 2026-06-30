import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess, financeAccessDenied } from "@/lib/financial-ops-access";
import {
  createPettyCashFund,
  listPettyCashFunds,
  pettyCashSummary,
  replenishPettyCash,
} from "@/lib/financial-ops/petty-cash-service";

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;
  const summary = await pettyCashSummary(projectId);
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (financeAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));

  if (body.action === "replenish") {
    const fund = await replenishPettyCash(body.fundId, Number(body.amount));
    if (!fund) return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    return NextResponse.json({ fund });
  }

  if (!body.custodianUserId || !body.floatAmount) {
    return NextResponse.json({ error: "custodianUserId and floatAmount required" }, { status: 400 });
  }

  const fund = await createPettyCashFund({
    projectId,
    custodianUserId: body.custodianUserId,
    floatAmount: Number(body.floatAmount),
    name: body.name,
    lowBalanceThreshold: body.lowBalanceThreshold,
  });
  return NextResponse.json({ fund });
}
