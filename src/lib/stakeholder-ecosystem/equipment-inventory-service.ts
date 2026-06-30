import { prisma } from "@/lib/prisma";

export async function listInventoryForCompany(companyId: string) {
  const tags = await prisma.equipmentInventoryTag.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    include: { equipment: { select: { id: true, companyName: true, category: true } } },
  });
  const byStatus: Record<string, number> = {};
  for (const t of tags) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }
  return { tags, summary: { total: tags.length, byStatus } };
}

export async function registerInventoryTag(input: {
  companyId: string;
  equipmentId: string;
  rfidTag: string;
  serialNumber?: string | null;
}) {
  return prisma.equipmentInventoryTag.create({
    data: {
      companyId: input.companyId,
      equipmentId: input.equipmentId,
      rfidTag: input.rfidTag.trim(),
      serialNumber: input.serialNumber?.trim() || null,
      status: "AVAILABLE",
    },
  });
}

export async function scanInventoryTag(companyId: string, rfidTag: string, location?: string) {
  const tag = await prisma.equipmentInventoryTag.findFirst({
    where: { rfidTag, companyId },
  });
  if (!tag) return { error: "Tag not found" as const, tag: null };
  const updated = await prisma.equipmentInventoryTag.update({
    where: { id: tag.id },
    data: { lastScanAt: new Date(), lastScanLocation: location ?? null },
  });
  return { error: null, tag: updated };
}

export async function inventoryWorkspaceSummary(companyId: string) {
  const { summary } = await listInventoryForCompany(companyId);
  return {
    totalTags: summary.total,
    available: summary.byStatus.AVAILABLE ?? 0,
    rented: summary.byStatus.RENTED ?? 0,
    maintenance: summary.byStatus.MAINTENANCE ?? 0,
  };
}
