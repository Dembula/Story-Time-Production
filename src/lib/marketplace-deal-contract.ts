import { prisma } from "@/lib/prisma";
import {
  buildRenderedContract,
  emptyFieldValues,
  mergeFieldValues,
  projectFieldValues,
  templateTypeForResourceKind,
  type ContractFieldValues,
  type ContractResourceKind,
} from "@/lib/contract-prefill";
import { getTemplateByType } from "@/lib/contract-template-engine";
import { toDateOnly, zCurrency } from "@/lib/contract-resource-context";

export type MarketplaceDealContractInput = {
  projectId: string;
  createdById: string;
  kind: ContractResourceKind;
  subject: string;
  partyName: string;
  partyType?: "INDIVIDUAL" | "COMPANY";
  role: string;
  rate: string;
  paymentTerms?: string;
  startDate?: string | null;
  endDate?: string | null;
  locationName?: string | null;
  equipmentList?: string | null;
  projectInvolvement?: string | null;
  counterpartyUserId?: string | null;
  castingTalentId?: string | null;
  crewTeamId?: string | null;
  locationListingId?: string | null;
  vendorName?: string | null;
  recipientEmail?: string | null;
  recipientLabel?: string | null;
  /** Idempotency key stored in changeNotes / looked up via subject marker */
  dealMarker: string;
};

async function loadProjectFields(projectId: string): Promise<ContractFieldValues> {
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      pitches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { creator: { select: { name: true } } },
      },
      shootDays: { orderBy: { date: "asc" }, select: { date: true } },
    },
  });
  if (!project) {
    return emptyFieldValues();
  }
  const shootDays = project.shootDays;
  const start = shootDays[0]?.date ?? null;
  const end = shootDays[shootDays.length - 1]?.date ?? null;
  return projectFieldValues({
    id: project.id,
    title: project.title,
    productionCompany: project.pitches[0]?.creator?.name?.trim() || "Production company TBD",
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
    shootDaysCount: shootDays.length,
  });
}

function legacyTypeForKind(kind: ContractResourceKind): string {
  if (kind === "ACTOR") return "ACTOR";
  if (kind === "CREW") return "CREW";
  if (kind === "LOCATION") return "LOCATION";
  return "VENDOR";
}

function recipientTypeForKind(kind: ContractResourceKind): string {
  if (kind === "ACTOR") return "ACTOR";
  if (kind === "CREW") return "CREW";
  if (kind === "LOCATION") return "LOCATION";
  if (kind === "EQUIPMENT") return "EQUIPMENT";
  if (kind === "CATERING") return "CATERING";
  return "VENDOR";
}

/**
 * Create (or reuse) a DRAFT project contract filled from marketplace deal + production data.
 * Idempotent on dealMarker within the project.
 */
export async function ensureMarketplaceDealContract(
  input: MarketplaceDealContractInput,
): Promise<{ contractId: string; created: boolean }> {
  const marker = `[marketplaceDeal:${input.dealMarker}]`;

  const existing = await prisma.projectContract.findFirst({
    where: {
      projectId: input.projectId,
      OR: [
        ...(input.castingTalentId
          ? [{ castingTalentId: input.castingTalentId, type: "ACTOR" as const }]
          : []),
        ...(input.crewTeamId ? [{ crewTeamId: input.crewTeamId, type: "CREW" as const }] : []),
        ...(input.locationListingId
          ? [{ locationListingId: input.locationListingId, type: "LOCATION" as const }]
          : []),
        { subject: { contains: marker } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { contractId: existing.id, created: false };
  }

  const templateType = templateTypeForResourceKind(input.kind);
  const template = getTemplateByType(templateType);
  const projectFields = await loadProjectFields(input.projectId);

  const merged = mergeFieldValues(emptyFieldValues(), projectFields, {
    party_name: input.partyName,
    party_type: input.partyType ?? (input.kind === "ACTOR" ? "INDIVIDUAL" : "COMPANY"),
    role: input.role,
    rate: input.rate,
    payment_terms:
      input.paymentTerms ??
      "Payment held in Story Time escrow until production confirms delivery.",
    start_date: input.startDate && input.startDate !== "TBD" ? input.startDate : undefined,
    end_date: input.endDate && input.endDate !== "TBD" ? input.endDate : undefined,
    location_name: input.locationName ?? undefined,
    equipment_list: input.equipmentList ?? undefined,
    project_involvement: input.projectInvolvement ?? undefined,
    custom_clauses: `Marketplace deal reference: ${input.dealMarker}`,
  });

  const terms = `${buildRenderedContract(templateType, merged, template.body)}\n\n${marker}`;

  const contract = await prisma.projectContract.create({
    data: {
      projectId: input.projectId,
      type: legacyTypeForKind(input.kind),
      status: "DRAFT",
      subject: `${input.subject} ${marker}`,
      counterpartyUserId: input.counterpartyUserId ?? null,
      castingTalentId: input.castingTalentId ?? null,
      crewTeamId: input.crewTeamId ?? null,
      locationListingId: input.locationListingId ?? null,
      vendorName: input.vendorName ?? input.partyName,
      recipientType: recipientTypeForKind(input.kind),
      recipientLabel: input.recipientLabel ?? input.partyName,
      recipientEmail: input.recipientEmail ?? null,
      jurisdiction: "South Africa",
      createdById: input.createdById,
    },
  });

  const version = await prisma.projectContractVersion.create({
    data: {
      contractId: contract.id,
      version: 1,
      terms,
      changeNotes: "Auto-generated from paid marketplace deal + production data",
      createdById: input.createdById,
    },
  });

  await prisma.projectContract.update({
    where: { id: contract.id },
    data: { currentVersionId: version.id },
  });

  return { contractId: contract.id, created: true };
}

export { zCurrency, toDateOnly };
