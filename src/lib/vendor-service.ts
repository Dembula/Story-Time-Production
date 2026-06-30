import { prisma } from "@/lib/prisma";
import type { VendorType } from "@/lib/financial-ops-types";

export type CreateVendorInput = {
  projectId: string;
  userId: string;
  displayName: string;
  vendorType?: VendorType | string;
  crewTeamId?: string | null;
  locationListingId?: string | null;
  equipmentListingId?: string | null;
  cateringCompanyId?: string | null;
  counterpartyUserId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  taxNumber?: string | null;
  paymentTerms?: string | null;
  bankDetails?: string | null;
  notes?: string | null;
};

export async function listProjectVendors(projectId: string) {
  return prisma.projectVendor.findMany({
    where: { projectId },
    orderBy: { displayName: "asc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { purchaseOrders: true, expenses: true } },
    },
  });
}

export async function createProjectVendor(input: CreateVendorInput) {
  return prisma.projectVendor.create({
    data: {
      projectId: input.projectId,
      displayName: input.displayName.trim(),
      vendorType: input.vendorType ?? "GENERAL",
      crewTeamId: input.crewTeamId ?? null,
      locationListingId: input.locationListingId ?? null,
      equipmentListingId: input.equipmentListingId ?? null,
      cateringCompanyId: input.cateringCompanyId ?? null,
      counterpartyUserId: input.counterpartyUserId ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      taxNumber: input.taxNumber ?? null,
      paymentTerms: input.paymentTerms ?? null,
      bankDetails: input.bankDetails ?? null,
      notes: input.notes ?? null,
      createdById: input.userId,
    },
  });
}

export async function updateProjectVendor(
  vendorId: string,
  projectId: string,
  patch: Partial<Omit<CreateVendorInput, "projectId" | "userId">> & { status?: string },
) {
  const existing = await prisma.projectVendor.findFirst({ where: { id: vendorId, projectId } });
  if (!existing) return null;

  return prisma.projectVendor.update({
    where: { id: vendorId },
    data: {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
      ...(patch.vendorType !== undefined ? { vendorType: patch.vendorType } : {}),
      ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
      ...(patch.contactPhone !== undefined ? { contactPhone: patch.contactPhone } : {}),
      ...(patch.taxNumber !== undefined ? { taxNumber: patch.taxNumber } : {}),
      ...(patch.paymentTerms !== undefined ? { paymentTerms: patch.paymentTerms } : {}),
      ...(patch.bankDetails !== undefined ? { bankDetails: patch.bankDetails } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.status !== undefined ? { status: patch.status as string } : {}),
    },
  });
}

export async function syncVendorsFromContracts(projectId: string, userId: string) {
  const contracts = await prisma.projectContract.findMany({
    where: { projectId, vendorName: { not: null } },
    select: { vendorName: true, type: true },
  });

  const existing = await prisma.projectVendor.findMany({
    where: { projectId },
    select: { displayName: true },
  });
  const names = new Set(existing.map((v) => v.displayName.toLowerCase()));

  const created = [];
  for (const c of contracts) {
    const name = c.vendorName?.trim();
    if (!name || names.has(name.toLowerCase())) continue;
    const vendor = await createProjectVendor({
      projectId,
      userId,
      displayName: name,
      vendorType: c.type === "VENDOR" ? "GENERAL" : c.type === "LOCATION" ? "LOCATION" : "CREW",
    });
    created.push(vendor);
    names.add(name.toLowerCase());
  }
  return created;
}
