import { prisma } from "@/lib/prisma";

function normalizeVendorName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function upsertGlobalVendor(input: {
  displayName: string;
  taxNumber?: string | null;
  vendorType?: string | null;
  country?: string | null;
}) {
  const normalizedName = normalizeVendorName(input.displayName);
  const existing = await prisma.globalVendor.findUnique({ where: { normalizedName } });
  if (existing) return existing;

  return prisma.globalVendor.create({
    data: {
      displayName: input.displayName.trim(),
      normalizedName,
      taxNumber: input.taxNumber ?? null,
      vendorType: input.vendorType ?? null,
      country: input.country ?? null,
    },
  });
}

export async function linkProjectVendorToGlobal(vendorId: string, projectId: string) {
  const vendor = await prisma.projectVendor.findFirst({ where: { id: vendorId, projectId } });
  if (!vendor) return null;

  const global = await upsertGlobalVendor({
    displayName: vendor.displayName,
    taxNumber: vendor.taxNumber,
    vendorType: vendor.vendorType,
  });

  return prisma.projectVendor.update({
    where: { id: vendorId },
    data: { globalVendorId: global.id },
  });
}

export async function refreshGlobalVendorStats(globalVendorId: string) {
  const links = await prisma.projectVendor.findMany({
    where: { globalVendorId },
    include: {
      expenses: { select: { amount: true } },
      project: { select: { id: true } },
    },
  });

  const projectIds = new Set(links.map((l) => l.projectId));
  const totalSpend = links.reduce((s, l) => s + l.expenses.reduce((a, e) => a + e.amount, 0), 0);

  return prisma.globalVendor.update({
    where: { id: globalVendorId },
    data: {
      totalSpendAcrossProjects: totalSpend,
      projectCount: projectIds.size,
      riskScore: totalSpend > 500_000 ? 0.3 : totalSpend > 100_000 ? 0.5 : 0.7,
    },
  });
}

export async function getVendorIntelligence(projectId: string, vendorId: string) {
  const vendor = await prisma.projectVendor.findFirst({
    where: { id: vendorId, projectId },
    include: {
      globalVendor: true,
      expenses: { orderBy: { spentAt: "desc" }, take: 20 },
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { expenses: true, purchaseOrders: true } },
    },
  });
  if (!vendor) return null;

  const projectSpend = vendor.expenses.reduce((s, e) => s + e.amount, 0);
  const global = vendor.globalVendor;

  return {
    vendor: {
      id: vendor.id,
      displayName: vendor.displayName,
      vendorType: vendor.vendorType,
      paymentTerms: vendor.paymentTerms,
      taxNumber: vendor.taxNumber,
    },
    projectSpend,
    expenseCount: vendor._count.expenses,
    poCount: vendor._count.purchaseOrders,
    recentExpenses: vendor.expenses.map((e) => ({ id: e.id, amount: e.amount, spentAt: e.spentAt })),
    recentPos: vendor.purchaseOrders.map((p) => ({ id: p.id, poNumber: p.poNumber, total: p.total, status: p.status })),
    global: global
      ? {
          totalSpendAcrossProjects: global.totalSpendAcrossProjects,
          projectCount: global.projectCount,
          riskScore: global.riskScore,
          avgPaymentDays: global.avgPaymentDays,
        }
      : null,
  };
}

export async function searchGlobalVendors(query: string, limit = 20) {
  const q = normalizeVendorName(query);
  return prisma.globalVendor.findMany({
    where: { normalizedName: { contains: q } },
    orderBy: { totalSpendAcrossProjects: "desc" },
    take: limit,
  });
}

export async function rebuildProjectVendorIntelligence(projectId: string) {
  const vendors = await prisma.projectVendor.findMany({ where: { projectId } });
  let linked = 0;
  for (const v of vendors) {
    await linkProjectVendorToGlobal(v.id, projectId);
    linked++;
  }
  const globals = await prisma.globalVendor.findMany({
    where: { projectVendors: { some: { projectId } } },
  });
  for (const g of globals) await refreshGlobalVendorStats(g.id);
  return { linked, globalCount: globals.length };
}
