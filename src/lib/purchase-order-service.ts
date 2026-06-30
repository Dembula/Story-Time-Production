import { prisma } from "@/lib/prisma";
import type { PoStatus } from "@/lib/financial-ops-types";

export type PoLineInput = {
  description: string;
  quantity?: number;
  unitCost?: number;
  budgetLineId?: string | null;
};

export type CreatePurchaseOrderInput = {
  projectId: string;
  userId: string;
  vendorId?: string | null;
  vendorName?: string | null;
  budgetLineId?: string | null;
  department?: string | null;
  description?: string | null;
  dueDate?: string | Date | null;
  vatRate?: number;
  lines: PoLineInput[];
};

async function nextPoNumber(projectId: string): Promise<string> {
  const count = await prisma.purchaseOrder.count({ where: { projectId } });
  const short = projectId.slice(-6).toUpperCase();
  return `PO-${short}-${String(count + 1).padStart(4, "0")}`;
}

function computeLineTotals(lines: PoLineInput[], vatRate = 0.15) {
  const mapped = lines.map((l) => {
    const qty = Math.max(0, Number(l.quantity ?? 1));
    const unit = Math.max(0, Number(l.unitCost ?? 0));
    const total = Math.round(qty * unit * 100) / 100;
    return { ...l, quantity: qty, unitCost: unit, total };
  });
  const subtotal = mapped.reduce((s, l) => s + l.total, 0);
  const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { mapped, subtotal, vatAmount, total };
}

export async function listPurchaseOrders(projectId: string) {
  return prisma.purchaseOrder.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      vendor: { select: { id: true, displayName: true } },
      lines: true,
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      _count: { select: { expenses: true, events: true } },
    },
  });
}

export async function getPurchaseOrder(projectId: string, poId: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id: poId, projectId },
    include: {
      vendor: true,
      lines: true,
      events: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } },
      expenses: { select: { id: true, amount: true, spentAt: true } },
    },
  });
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const { mapped, subtotal, vatAmount, total } = computeLineTotals(input.lines, input.vatRate);
  const poNumber = await nextPoNumber(input.projectId);

  let vendorId = input.vendorId ?? null;
  if (!vendorId && input.vendorName?.trim()) {
    const vendor = await prisma.projectVendor.create({
      data: {
        projectId: input.projectId,
        displayName: input.vendorName.trim(),
        vendorType: "GENERAL",
        createdById: input.userId,
      },
    });
    vendorId = vendor.id;
  }

  return prisma.purchaseOrder.create({
    data: {
      projectId: input.projectId,
      poNumber,
      vendorId,
      budgetLineId: input.budgetLineId ?? null,
      department: input.department ?? null,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      subtotal,
      vatAmount,
      total,
      requestedById: input.userId,
      status: "DRAFT",
      lines: {
        create: mapped.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitCost: l.unitCost,
          total: l.total,
          budgetLineId: l.budgetLineId ?? null,
        })),
      },
      events: {
        create: { userId: input.userId, eventType: "CREATED", detail: `PO ${poNumber} created` },
      },
    },
    include: { lines: true, vendor: true },
  });
}

async function logPoEvent(
  poId: string,
  userId: string | null,
  eventType: string,
  detail?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.purchaseOrderEvent.create({
    data: { poId, userId, eventType, detail, metadata: metadata as object | undefined },
  });
}

export async function submitPurchaseOrderForApproval(projectId: string, poId: string, userId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, projectId } });
  if (!po || po.status !== "DRAFT") return { error: "PO not in DRAFT status" as const, po: null };

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "PENDING_APPROVAL" },
    include: { lines: true, vendor: true },
  });
  await logPoEvent(poId, userId, "SUBMITTED", "Submitted for approval");
  return { error: null, po: updated };
}

export async function approvePurchaseOrder(projectId: string, poId: string, userId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, projectId } });
  if (!po || po.status !== "PENDING_APPROVAL") return { error: "PO not pending approval" as const, po: null };

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    include: { lines: true, vendor: true },
  });
  await logPoEvent(poId, userId, "APPROVED", "Purchase order approved");
  return { error: null, po: updated };
}

export async function rejectPurchaseOrder(
  projectId: string,
  poId: string,
  userId: string,
  reason?: string,
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, projectId } });
  if (!po || po.status !== "PENDING_APPROVAL") return { error: "PO not pending approval" as const, po: null };

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason ?? null,
    },
    include: { lines: true, vendor: true },
  });
  await logPoEvent(poId, userId, "REJECTED", reason ?? "Rejected");
  return { error: null, po: updated };
}

export async function updatePurchaseOrderStatus(
  projectId: string,
  poId: string,
  userId: string,
  status: PoStatus,
) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, projectId } });
  if (!po) return null;

  const data: {
    status: PoStatus;
    sentAt?: Date;
  } = { status };
  if (status === "SENT") data.sentAt = new Date();

  const updated = await prisma.purchaseOrder.update({
    where: { id: poId },
    data,
    include: { lines: true, vendor: true },
  });
  await logPoEvent(poId, userId, status, `Status → ${status}`);
  return updated;
}

export function poPipelineSummary(orders: Array<{ status: string; total: number }>) {
  const byStatus: Record<string, { count: number; total: number }> = {};
  for (const o of orders) {
    byStatus[o.status] = byStatus[o.status] ?? { count: 0, total: 0 };
    byStatus[o.status].count += 1;
    byStatus[o.status].total += o.total;
  }
  return byStatus;
}
