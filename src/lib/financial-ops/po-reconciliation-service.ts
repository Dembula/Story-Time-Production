import { prisma } from "@/lib/prisma";

export async function receivePurchaseOrderLine(input: {
  projectId: string;
  poId: string;
  lineId: string;
  receivedQty: number;
  userId: string;
}) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.poId, projectId: input.projectId },
    include: { lines: true },
  });
  if (!po) return { error: "PO not found" as const };

  const line = po.lines.find((l) => l.id === input.lineId);
  if (!line) return { error: "Line not found" as const };

  const qty = Math.min(line.quantity, Math.max(0, input.receivedQty));
  await prisma.purchaseOrderLine.update({
    where: { id: line.id },
    data: { receivedQty: qty },
  });

  await prisma.purchaseOrderEvent.create({
    data: {
      poId: po.id,
      userId: input.userId,
      eventType: "RECEIVED",
      detail: `Received ${qty} of ${line.description}`,
    },
  });

  return reconcilePurchaseOrder(input.projectId, input.poId);
}

export async function linkExpenseToPurchaseOrder(input: {
  projectId: string;
  expenseId: string;
  poId: string;
  userId: string;
}) {
  const [expense, po] = await Promise.all([
    prisma.productionExpense.findFirst({ where: { id: input.expenseId, projectId: input.projectId } }),
    prisma.purchaseOrder.findFirst({ where: { id: input.poId, projectId: input.projectId }, include: { vendor: true } }),
  ]);
  if (!expense || !po) return { error: "Not found" as const };

  await prisma.productionExpense.update({
    where: { id: expense.id },
    data: {
      purchaseOrderId: po.id,
      vendorId: po.vendorId ?? expense.vendorId,
    },
  });

  await prisma.purchaseOrderEvent.create({
    data: {
      poId: po.id,
      userId: input.userId,
      eventType: "EXPENSE_LINKED",
      detail: `Expense ${expense.id.slice(0, 8)} linked`,
      metadata: { expenseId: expense.id, amount: expense.amount },
    },
  });

  return reconcilePurchaseOrder(input.projectId, po.id);
}

export async function reconcilePurchaseOrder(projectId: string, poId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, projectId },
    include: { lines: true, expenses: true },
  });
  if (!po) return { error: "PO not found" as const };

  const expensedTotal = po.expenses.reduce((s, e) => s + e.amount, 0);
  const allReceived = po.lines.every((l) => l.receivedQty >= l.quantity);
  const fullyExpensed = expensedTotal >= po.total * 0.99;

  let nextStatus = po.status;
  if (allReceived || expensedTotal > 0) nextStatus = "PARTIAL";
  if (allReceived && fullyExpensed) nextStatus = "CLOSED";

  if (nextStatus !== po.status) {
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
  }

  return {
    error: null,
    poId: po.id,
    status: nextStatus,
    expensedTotal,
    poTotal: po.total,
    variance: po.total - expensedTotal,
    lines: po.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      receivedQty: l.receivedQty,
      total: l.total,
    })),
  };
}

export async function listPoReconciliation(projectId: string) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { projectId, status: { in: ["APPROVED", "SENT", "PARTIAL"] } },
    include: {
      lines: true,
      expenses: { select: { id: true, amount: true, spentAt: true } },
      vendor: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    vendor: po.vendor?.displayName ?? null,
    total: po.total,
    expensed: po.expenses.reduce((s, e) => s + e.amount, 0),
    receivedPct:
      po.lines.length ?
        Math.round((po.lines.reduce((s, l) => s + l.receivedQty / Math.max(l.quantity, 1), 0) / po.lines.length) * 100)
      : 0,
    expenseCount: po.expenses.length,
  }));
}
