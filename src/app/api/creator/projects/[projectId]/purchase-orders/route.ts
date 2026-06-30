import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess } from "@/lib/financial-ops-access";
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  rejectPurchaseOrder,
  submitPurchaseOrderForApproval,
  updatePurchaseOrderStatus,
} from "@/lib/purchase-order-service";
import {
  linkExpenseToPurchaseOrder,
  listPoReconciliation,
  receivePurchaseOrderLine,
  reconcilePurchaseOrder,
} from "@/lib/financial-ops/po-reconciliation-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const orders = await listPurchaseOrders(projectId);
  const reconciliation = await listPoReconciliation(projectId);
  return NextResponse.json({ orders, reconciliation });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error || !access.userId) return access.error;

  const body = await req.json().catch(() => ({}));
  const order = await createPurchaseOrder({
    projectId,
    userId: access.userId,
    vendorId: body.vendorId,
    vendorName: body.vendorName,
    budgetLineId: body.budgetLineId,
    department: body.department,
    description: body.description,
    dueDate: body.dueDate,
    vatRate: body.vatRate,
    lines: Array.isArray(body.lines) ? body.lines : [{ description: body.description ?? "Line item", quantity: 1, unitCost: body.amount ?? 0 }],
  });

  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error || !access.userId) return access.error;

  const body = await req.json().catch(() => ({}));
  const poId = body.poId as string;
  const action = body.action as string;

  if (!poId) return NextResponse.json({ error: "poId required" }, { status: 400 });

  if (action === "submit") {
    const result = await submitPurchaseOrderForApproval(projectId, poId, access.userId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ order: result.po });
  }
  if (action === "approve") {
    const result = await approvePurchaseOrder(projectId, poId, access.userId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ order: result.po });
  }
  if (action === "reject") {
    const result = await rejectPurchaseOrder(projectId, poId, access.userId, body.reason);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ order: result.po });
  }
  if (action === "send" || action === "close" || action === "cancel") {
    const statusMap: Record<string, "SENT" | "CLOSED" | "CANCELLED"> = {
      send: "SENT",
      close: "CLOSED",
      cancel: "CANCELLED",
    };
    const order = await updatePurchaseOrderStatus(projectId, poId, access.userId, statusMap[action]!);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order });
  }
  if (action === "receive") {
    const result = await receivePurchaseOrderLine({
      projectId,
      poId,
      lineId: body.lineId,
      receivedQty: Number(body.receivedQty),
      userId: access.userId,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === "reconcile") {
    const result = await reconcilePurchaseOrder(projectId, poId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }
  if (action === "link_expense") {
    const result = await linkExpenseToPurchaseOrder({
      projectId,
      poId,
      expenseId: body.expenseId,
      userId: access.userId,
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
