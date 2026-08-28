import { prisma } from "@/lib/prisma";
import { parseMarketplaceBookingNote } from "@/lib/marketplace-booking-context";
import {
  ensureMarketplaceDealContract,
  toDateOnly,
  zCurrency,
} from "@/lib/marketplace-deal-contract";
import type { MarketplaceEntityType, MarketplaceSettlementQuote } from "@/lib/payments/marketplace-settlement";
import { createProjectVendor } from "@/lib/vendor-service";

const NEED_LINK_MARKER_PREFIX = "crewNeedId:";
const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";

async function upsertVendor(args: {
  projectId: string;
  userId: string;
  displayName: string;
  vendorType: string;
  crewTeamId?: string | null;
  locationListingId?: string | null;
  equipmentListingId?: string | null;
  cateringCompanyId?: string | null;
  counterpartyUserId?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}) {
  const existing = await prisma.projectVendor.findFirst({
    where: {
      projectId: args.projectId,
      OR: [
        ...(args.crewTeamId ? [{ crewTeamId: args.crewTeamId }] : []),
        ...(args.locationListingId ? [{ locationListingId: args.locationListingId }] : []),
        ...(args.equipmentListingId ? [{ equipmentListingId: args.equipmentListingId }] : []),
        ...(args.cateringCompanyId ? [{ cateringCompanyId: args.cateringCompanyId }] : []),
        { displayName: { equals: args.displayName, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.projectVendor.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        contactEmail: args.contactEmail ?? undefined,
        notes: args.notes ?? undefined,
        crewTeamId: args.crewTeamId ?? undefined,
        locationListingId: args.locationListingId ?? undefined,
        equipmentListingId: args.equipmentListingId ?? undefined,
        cateringCompanyId: args.cateringCompanyId ?? undefined,
        counterpartyUserId: args.counterpartyUserId ?? undefined,
      },
    });
    return existing.id;
  }
  const vendor = await createProjectVendor({
    projectId: args.projectId,
    userId: args.userId,
    displayName: args.displayName,
    vendorType: args.vendorType,
    crewTeamId: args.crewTeamId,
    locationListingId: args.locationListingId,
    equipmentListingId: args.equipmentListingId,
    cateringCompanyId: args.cateringCompanyId,
    counterpartyUserId: args.counterpartyUserId,
    contactEmail: args.contactEmail,
    notes: args.notes,
  });
  return vendor.id;
}

async function syncLocationBooking(quote: MarketplaceSettlementQuote) {
  const row = await prisma.locationBooking.findUnique({
    where: { id: quote.entityId },
    include: {
      location: {
        include: { company: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!row) return;
  const ctx = parseMarketplaceBookingNote(row.note);
  if (!ctx.projectId) return;

  const location = row.location;
  await upsertVendor({
    projectId: ctx.projectId,
    userId: quote.buyerUserId,
    displayName: location.name,
    vendorType: "LOCATION",
    locationListingId: location.id,
    counterpartyUserId: location.companyId,
    contactEmail: location.company?.email ?? null,
    notes: `Paid location booking ${row.id}`,
  });

  const linked = await prisma.breakdownLocation.findFirst({
    where: { projectId: ctx.projectId, locationListingId: location.id },
    select: { id: true },
  });
  if (!linked) {
    const nameMatch = await prisma.breakdownLocation.findFirst({
      where: {
        projectId: ctx.projectId,
        locationListingId: null,
        name: { equals: location.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (nameMatch) {
      await prisma.breakdownLocation.update({
        where: { id: nameMatch.id },
        data: {
          locationListingId: location.id,
          marketplaceLinkedAt: new Date(),
          marketplaceLinkedBy: "USER",
          marketplaceMatchNote: `Linked from paid booking ${row.id}`,
        },
      });
    } else {
      await prisma.breakdownLocation.create({
        data: {
          projectId: ctx.projectId,
          name: location.name,
          description: [location.city, location.type].filter(Boolean).join(" · ") || null,
          locationListingId: location.id,
          marketplaceLinkedAt: new Date(),
          marketplaceLinkedBy: "USER",
          marketplaceMatchNote: `Created from paid marketplace booking ${row.id}`,
        },
      });
    }
  }

  await ensureMarketplaceDealContract({
    projectId: ctx.projectId,
    createdById: quote.buyerUserId,
    kind: "LOCATION",
    subject: `Location agreement · ${location.name}`,
    partyName: location.name,
    partyType: "COMPANY",
    role: `Location hire — ${location.type ?? "location"}`,
    rate: zCurrency(quote.baseAmount),
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    locationName: location.name,
    counterpartyUserId: location.companyId,
    locationListingId: location.id,
    vendorName: location.name,
    recipientEmail: location.company?.email ?? null,
    dealMarker: `LocationBooking:${row.id}`,
  });
}

async function resolveProjectIdFromNote(
  note: string | null | undefined,
  projectName: string | null | undefined,
  creatorId: string,
): Promise<{ projectId: string | null; projectTitle: string | null }> {
  const ctx = parseMarketplaceBookingNote(note);
  if (ctx.projectId) {
    return { projectId: ctx.projectId, projectTitle: ctx.projectTitle };
  }
  const name = (projectName || ctx.projectTitle || "").trim();
  if (!name) return { projectId: null, projectTitle: null };
  const project = await prisma.originalProject.findFirst({
    where: {
      title: { equals: name, mode: "insensitive" },
      pitches: { some: { creatorId } },
    },
    select: { id: true, title: true },
  });
  return { projectId: project?.id ?? null, projectTitle: project?.title ?? name };
}

async function syncEquipmentRequest(quote: MarketplaceSettlementQuote) {
  const row = await prisma.equipmentRequest.findUnique({
    where: { id: quote.entityId },
    include: {
      equipment: {
        include: { company: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!row) return;
  const ctx = parseMarketplaceBookingNote(row.note);
  if (!ctx.projectId) return;

  const equipment = row.equipment;
  await upsertVendor({
    projectId: ctx.projectId,
    userId: quote.buyerUserId,
    displayName: equipment.companyName,
    vendorType: "EQUIPMENT",
    equipmentListingId: equipment.id,
    counterpartyUserId: equipment.companyId,
    contactEmail: equipment.company?.email ?? null,
    notes: `Paid equipment request ${row.id}`,
  });

  const existingPlan = await prisma.equipmentPlanItem.findFirst({
    where: { projectId: ctx.projectId, equipmentListingId: equipment.id },
    select: { id: true },
  });
  if (!existingPlan) {
    await prisma.equipmentPlanItem.create({
      data: {
        projectId: ctx.projectId,
        category: equipment.category,
        description: equipment.description ?? equipment.companyName,
        quantity: 1,
        notes: `From paid marketplace request ${row.id}`,
        equipmentListingId: equipment.id,
      },
    });
  }

  await ensureMarketplaceDealContract({
    projectId: ctx.projectId,
    createdById: quote.buyerUserId,
    kind: "EQUIPMENT",
    subject: `Equipment rental · ${equipment.category}`,
    partyName: equipment.companyName,
    partyType: "COMPANY",
    role: `Equipment rental — ${equipment.category}`,
    rate: zCurrency(quote.baseAmount),
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    equipmentList: [equipment.category, equipment.description].filter(Boolean).join(" · "),
    counterpartyUserId: equipment.companyId,
    vendorName: equipment.companyName,
    recipientEmail: equipment.company?.email ?? null,
    dealMarker: `EquipmentRequest:${row.id}`,
  });
}

async function syncCateringBooking(quote: MarketplaceSettlementQuote) {
  const row = await prisma.cateringBooking.findUnique({
    where: { id: quote.entityId },
    include: {
      cateringCompany: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!row) return;
  const ctx = parseMarketplaceBookingNote(row.note);
  if (!ctx.projectId) return;

  const company = row.cateringCompany;
  await upsertVendor({
    projectId: ctx.projectId,
    userId: quote.buyerUserId,
    displayName: company.companyName,
    vendorType: "CATERING",
    cateringCompanyId: company.id,
    counterpartyUserId: company.userId,
    contactEmail: company.user?.email ?? null,
    notes: `Paid catering booking ${row.id}`,
  });

  await ensureMarketplaceDealContract({
    projectId: ctx.projectId,
    createdById: quote.buyerUserId,
    kind: "CATERING",
    subject: `Catering agreement · ${company.companyName}`,
    partyName: company.companyName,
    partyType: "COMPANY",
    role: `On-set catering${row.headCount ? ` (${row.headCount} people)` : ""}`,
    rate: zCurrency(quote.baseAmount),
    startDate: toDateOnly(row.eventDate),
    endDate: toDateOnly(row.eventDate),
    counterpartyUserId: company.userId,
    vendorName: company.companyName,
    recipientEmail: company.user?.email ?? null,
    dealMarker: `CateringBooking:${row.id}`,
  });
}

async function syncCrewTeamRequest(quote: MarketplaceSettlementQuote) {
  const row = await prisma.crewTeamRequest.findUnique({
    where: { id: quote.entityId },
    include: {
      crewTeam: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          members: { take: 20, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!row) return;
  const resolved = await resolveProjectIdFromNote(row.message, row.projectName, quote.buyerUserId);
  const projectId = resolved.projectId;
  if (!projectId) return;

  const team = row.crewTeam;
  await upsertVendor({
    projectId,
    userId: quote.buyerUserId,
    displayName: team.companyName,
    vendorType: "CREW",
    crewTeamId: team.id,
    counterpartyUserId: team.userId,
    contactEmail: team.user?.email ?? null,
    notes: `Paid crew team request ${row.id}`,
  });

  for (const member of team.members) {
    const marker = `crewTeamRequest:${row.id}:member:${member.id}`;
    const existing = await prisma.creatorCrewRoster.findFirst({
      where: { creatorId: quote.buyerUserId, notes: { contains: marker } },
      select: { id: true },
    });
    const notes = `Hired via ${team.companyName} for project.\n[${marker}]\n[${NEED_LINK_MARKER_PREFIX}marketplace]`;
    if (existing) {
      await prisma.creatorCrewRoster.update({
        where: { id: existing.id },
        data: {
          name: member.name,
          role: member.role ?? null,
          department: member.department ?? null,
          contactEmail: member.email ?? null,
          phone: member.phone ?? null,
          notes,
          pastProjects: member.pastWork ?? null,
        },
      });
    } else {
      await prisma.creatorCrewRoster.create({
        data: {
          creatorId: quote.buyerUserId,
          name: member.name,
          role: member.role ?? null,
          department: member.department ?? null,
          contactEmail: member.email ?? null,
          phone: member.phone ?? null,
          notes,
          pastProjects: member.pastWork ?? null,
        },
      });
    }
  }

  await ensureMarketplaceDealContract({
    projectId,
    createdById: quote.buyerUserId,
    kind: "CREW",
    subject: `Crew agreement · ${team.companyName}`,
    partyName: team.companyName,
    partyType: "COMPANY",
    role: team.specializations?.trim() || "Crew services",
    rate: zCurrency(quote.baseAmount),
    projectInvolvement: resolved.projectTitle
      ? `Engaged for ${resolved.projectTitle}`
      : "Engaged via Story Time crew marketplace",
    counterpartyUserId: team.userId,
    crewTeamId: team.id,
    vendorName: team.companyName,
    recipientEmail: team.user?.email ?? null,
    dealMarker: `CrewTeamRequest:${row.id}`,
  });
}

async function syncCastingInquiry(quote: MarketplaceSettlementQuote) {
  const row = await prisma.castingInquiry.findUnique({
    where: { id: quote.entityId },
    include: {
      agency: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!row) return;
  const resolved = await resolveProjectIdFromNote(row.message, row.projectName, quote.buyerUserId);
  const projectId = resolved.projectId;
  if (!projectId) return;

  const agency = row.agency;
  await upsertVendor({
    projectId,
    userId: quote.buyerUserId,
    displayName: agency.agencyName,
    vendorType: "GENERAL",
    counterpartyUserId: agency.userId,
    contactEmail: agency.user?.email ?? agency.contactEmail ?? null,
    notes: `Paid casting inquiry ${row.id}`,
  });

  const talent = row.talentId
    ? await prisma.castingTalent.findUnique({ where: { id: row.talentId } })
    : null;

  if (talent) {
    const marker = `${ROLE_LINK_MARKER_PREFIX}inquiry:${row.id}`;
    const existing = await prisma.creatorCastRoster.findFirst({
      where: { creatorId: quote.buyerUserId, notes: { contains: marker } },
      select: { id: true },
    });
    const notes = `From ${agency.agencyName} (paid inquiry).\n[${marker}]`;
    if (existing) {
      await prisma.creatorCastRoster.update({
        where: { id: existing.id },
        data: {
          name: talent.name,
          roleType: "Actor",
          contactEmail: talent.contactEmail ?? null,
          pastWork: talent.pastWork ?? null,
          notes,
        },
      });
    } else {
      await prisma.creatorCastRoster.create({
        data: {
          creatorId: quote.buyerUserId,
          name: talent.name,
          roleType: "Actor",
          contactEmail: talent.contactEmail ?? null,
          pastWork: talent.pastWork ?? null,
          notes,
        },
      });
    }

    await ensureMarketplaceDealContract({
      projectId,
      createdById: quote.buyerUserId,
      kind: "ACTOR",
      subject: `Actor agreement · ${talent.name}`,
      partyName: talent.name,
      partyType: "INDIVIDUAL",
      role: row.roleName?.trim() || "Actor",
      rate: zCurrency(quote.baseAmount),
      counterpartyUserId: agency.userId,
      castingTalentId: talent.id,
      vendorName: agency.agencyName,
      recipientEmail: talent.contactEmail ?? agency.user?.email ?? null,
      recipientLabel: talent.name,
      dealMarker: `CastingInquiry:${row.id}`,
    });
  } else {
    await ensureMarketplaceDealContract({
      projectId,
      createdById: quote.buyerUserId,
      kind: "GENERAL",
      subject: `Casting services · ${agency.agencyName}`,
      partyName: agency.agencyName,
      partyType: "COMPANY",
      role: row.roleName?.trim() || "Casting services",
      rate: zCurrency(quote.baseAmount),
      counterpartyUserId: agency.userId,
      vendorName: agency.agencyName,
      recipientEmail: agency.user?.email ?? null,
      dealMarker: `CastingInquiry:${row.id}`,
    });
  }
}

/**
 * After a marketplace booking/request is paid: attach vendor to production,
 * update roster/breakdown/equipment plan, and draft a filled contract.
 */
export async function syncMarketplaceDealToProduction(
  quote: MarketplaceSettlementQuote,
): Promise<void> {
  try {
    if (quote.entityType === "LocationBooking") {
      await syncLocationBooking(quote);
      return;
    }
    if (quote.entityType === "EquipmentRequest") {
      await syncEquipmentRequest(quote);
      return;
    }
    if (quote.entityType === "CateringBooking") {
      await syncCateringBooking(quote);
      return;
    }
    if (quote.entityType === "CrewTeamRequest") {
      await syncCrewTeamRequest(quote);
      return;
    }
    if (quote.entityType === "CastingInquiry") {
      await syncCastingInquiry(quote);
    }
  } catch (err) {
    console.error("[marketplace-production-sync]", quote.entityType, quote.entityId, err);
  }
}

export type { MarketplaceEntityType };
