import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { parseEmbeddedMeta, type ActorMarketMeta, type EquipmentMarketMeta } from "@/lib/marketplace-profile-meta";
import { parseFundingDetails } from "@/lib/funding-hub-db";
import type { ContractProjectContext, ContractResourceOption } from "@/lib/contract-prefill";

const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";
const NEED_LINK_MARKER_PREFIX = "crewNeedId:";

export function zCurrency(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "TBD";
  return `R${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "TBD";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toISOString().slice(0, 10);
}

export type ContractResourceContextPayload = {
  project: ContractProjectContext;
  resources: {
    actors: ContractResourceOption[];
    crew: ContractResourceOption[];
    locations: ContractResourceOption[];
    equipment: ContractResourceOption[];
    catering: ContractResourceOption[];
    funding: ContractResourceOption[];
  };
};

export async function buildContractResourceContext(
  projectId: string,
  creatorId: string,
): Promise<ContractResourceContextPayload | null> {
  const [project, budget, actorRoles, crewNeeds, locationBreakdowns, equipmentItems, cateringBookings, fundingProfile] =
    await Promise.all([
      prisma.originalProject.findUnique({
        where: { id: projectId },
        include: {
          pitches: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { creator: { select: { id: true, name: true, email: true } } },
          },
          shootDays: { orderBy: { date: "asc" }, select: { date: true } },
        },
      }),
      resolveDefaultProjectBudget(projectId),
      prisma.castingRole.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: {
          invitations: {
            where: { status: "ACCEPTED" },
            orderBy: { respondedAt: "desc" },
            take: 1,
            include: {
              talent: { include: { castingAgency: true } },
              castingAgency: true,
            },
          },
        },
      }),
      prisma.crewRoleNeed.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: {
          invitations: {
            where: { status: "ACCEPTED" },
            orderBy: { respondedAt: "desc" },
            take: 1,
            include: {
              crewTeam: { select: { id: true, companyName: true, userId: true } },
              crewMember: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.breakdownLocation.findMany({
        where: { projectId },
        include: {
          locationListing: {
            include: {
              bookings: { orderBy: { createdAt: "desc" }, take: 1 },
              company: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.equipmentPlanItem.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: {
          equipmentListing: {
            include: {
              company: { select: { id: true, name: true, email: true } },
              requests: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      }),
      prisma.cateringBooking.findMany({
        where: { creatorId, status: { in: ["PENDING", "CONFIRMED", "ACCEPTED"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          cateringCompany: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.fundingRequest.findUnique({ where: { projectId } }),
    ]);

  if (!project) return null;

  const shootDaysCount = project.shootDays.length;
  const earliestDay = project.shootDays[0]?.date ?? null;
  const latestDay = project.shootDays[shootDaysCount - 1]?.date ?? null;
  const durationLabel =
    shootDaysCount > 0
      ? `${shootDaysCount} shoot day${shootDaysCount === 1 ? "" : "s"} (${toDateOnly(earliestDay)} to ${toDateOnly(latestDay)})`
      : "TBD";

  const productionCompany =
    project.pitches[0]?.productionCompany ||
    project.pitches[0]?.creator?.name ||
    "Story Time Production";

  const salaryByRoleName = new Map<string, number>();
  for (const line of budget?.lines ?? []) {
    if ((line.department ?? "").toUpperCase() !== "CAST") continue;
    const amount = Number(line.unitCost ?? line.total ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const normalized = line.name
      .replace(/^Salary\s*·\s*/i, "")
      .replace(/^Character:\s*/i, "")
      .trim()
      .toLowerCase();
    if (normalized) salaryByRoleName.set(normalized, amount);
  }

  const actorResources: ContractResourceOption[] = actorRoles.map((role) => {
    const accepted = role.invitations[0];
    const talent = accepted?.talent ?? null;
    const agency = accepted?.castingAgency ?? talent?.castingAgency ?? null;
    const marker = `${ROLE_LINK_MARKER_PREFIX}${role.id}`;
    const budgetLine = budget?.lines.find((l) => (l.notes ?? "").includes(marker));
    const talentMeta = talent?.bio ? parseEmbeddedMeta<ActorMarketMeta>(talent.bio) : null;
    const roleKey = role.name.trim().toLowerCase();
    const salaryFromBudget =
      budgetLine?.unitCost ?? budgetLine?.total ?? salaryByRoleName.get(roleKey) ?? null;
    const dailyFromTalent = Number(talentMeta?.meta?.dailyRate ?? 0);
    const rateAmount = salaryFromBudget ?? (dailyFromTalent > 0 ? dailyFromTalent : null);

    return {
      id: role.id,
      kind: "ACTOR",
      partyName: talent?.name ?? "",
      partyType: agency?.agencyName ? "COMPANY" : "INDIVIDUAL",
      role: role.name,
      rate: zCurrency(rateAmount),
      paymentTerms: "Per call sheet / approved payroll cycle; BCEA minimums apply if employee",
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
      projectInvolvement: role.description || `Cast role on ${project.title}`,
      locationName: "N/A",
      equipmentList: "N/A",
      shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
      serviceDuration: durationLabel,
      counterpartyUserId: agency?.userId ?? null,
      castingTalentId: talent?.id ?? null,
      crewTeamId: null,
      locationListingId: null,
      vendorName: agency?.agencyName ?? null,
      label: `${role.name}${talent?.name ? ` · ${talent.name}` : " · (assign performer)"}`,
    };
  });

  const creatorCrew = await prisma.creatorCrewRoster.findMany({
    where: { creatorId },
    orderBy: { updatedAt: "desc" },
  });

  const crewResources: ContractResourceOption[] = crewNeeds.map((need) => {
    const marker = `${NEED_LINK_MARKER_PREFIX}${need.id}`;
    const budgetLine = budget?.lines.find((l) => (l.notes ?? "").includes(marker));
    const roster = creatorCrew.find((m) => (m.notes ?? "").includes(marker));
    const acceptedInvite = need.invitations[0];
    const team = acceptedInvite?.crewTeam ?? null;
    const member = acceptedInvite?.crewMember ?? null;

    return {
      id: need.id,
      kind: "CREW",
      partyName: member?.name ?? roster?.name ?? "",
      partyType: team ? "COMPANY" : "INDIVIDUAL",
      role: `${need.department ?? "Crew"} / ${need.role}`,
      rate: zCurrency(budgetLine?.unitCost ?? null),
      paymentTerms: "Per timesheet approval and production payroll terms",
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
      projectInvolvement: need.notes || `Crew need: ${need.role}`,
      locationName: "N/A",
      equipmentList: "N/A",
      shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
      serviceDuration: durationLabel,
      counterpartyUserId: team?.userId ?? null,
      castingTalentId: null,
      crewTeamId: team?.id ?? null,
      locationListingId: null,
      vendorName: team?.companyName ?? null,
      label: `${need.role}${member?.name || roster?.name ? ` · ${member?.name ?? roster?.name}` : " · (assign crew)"}`,
    };
  });

  const locationResources: ContractResourceOption[] = locationBreakdowns
    .filter((loc) => loc.locationListing)
    .map((loc) => {
      const listing = loc.locationListing!;
      const booking = listing.bookings[0];
      return {
        id: loc.id,
        kind: "LOCATION",
        partyName: listing.company?.name ?? listing.name,
        partyType: listing.companyId ? "COMPANY" : "INDIVIDUAL",
        role: "Location use agreement",
        rate: zCurrency(listing.dailyRate ?? null),
        paymentTerms: "Per booking confirmation and usage compliance",
        startDate: booking?.startDate ?? toDateOnly(earliestDay),
        endDate: booking?.endDate ?? toDateOnly(latestDay),
        projectInvolvement: loc.name,
        locationName: listing.name,
        equipmentList: "N/A",
        shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
        serviceDuration: durationLabel,
        counterpartyUserId: listing.companyId ?? null,
        castingTalentId: null,
        crewTeamId: null,
        locationListingId: listing.id,
        vendorName: null,
        label: `${listing.name} · ${loc.name}`,
      };
    });

  const equipmentResources: ContractResourceOption[] = equipmentItems
    .filter((item) => item.equipmentListing)
    .map((item) => {
      const listing = item.equipmentListing!;
      const meta = parseEmbeddedMeta<EquipmentMarketMeta>(listing.description);
      const req = listing.requests[0];
      return {
        id: item.id,
        kind: "EQUIPMENT",
        partyName: listing.company?.name ?? listing.companyName,
        partyType: listing.companyId ? "COMPANY" : "INDIVIDUAL",
        role: `${item.category} rental`,
        rate: zCurrency(meta.meta?.dailyRate ?? null),
        paymentTerms: "Per rental terms and return condition checklist",
        startDate: req?.startDate ?? toDateOnly(earliestDay),
        endDate: req?.endDate ?? toDateOnly(latestDay),
        projectInvolvement: `${item.category} (qty ${item.quantity})`,
        locationName: "N/A",
        equipmentList: item.description || meta.plain || `${item.category} x${item.quantity}`,
        shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
        serviceDuration: durationLabel,
        counterpartyUserId: listing.companyId ?? null,
        castingTalentId: null,
        crewTeamId: null,
        locationListingId: null,
        vendorName: listing.companyName,
        label: `${listing.companyName} · ${item.category} x${item.quantity}`,
      };
    });

  const cateringResources: ContractResourceOption[] = cateringBookings.map((booking) => {
    const company = booking.cateringCompany;
    return {
      id: booking.id,
      kind: "CATERING",
      partyName: company?.companyName ?? company?.user?.name ?? "",
      partyType: "COMPANY",
      role: "On-set catering services",
      rate: "TBD",
      paymentTerms: "Per confirmed headcount and service date invoice",
      startDate: booking.eventDate ?? toDateOnly(earliestDay),
      endDate: booking.eventDate ?? toDateOnly(latestDay),
      projectInvolvement: booking.headCount
        ? `Headcount: ${booking.headCount}${booking.note ? ` — ${booking.note}` : ""}`
        : booking.note || "Catering booking",
      locationName: "N/A",
      equipmentList: "N/A",
      shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
      serviceDuration: durationLabel,
      counterpartyUserId: company?.userId ?? null,
      castingTalentId: null,
      crewTeamId: null,
      locationListingId: null,
      vendorName: company?.companyName ?? null,
      label: `${company?.companyName ?? "Caterer"} · ${booking.eventDate ?? "Date TBD"}`,
    };
  });

  let fundingSources: Array<{ id: string; name: string; amount?: number; terms?: string }> = [];
  if (fundingProfile?.details) {
    const parsed = parseFundingDetails(fundingProfile.details);
    fundingSources = parsed.structured.sources.map((src) => ({
      id: src.id,
      name: src.name,
      amount: src.amountCommitted,
      terms: src.paymentSchedule ?? src.conditions ?? undefined,
    }));
  }

  const fundingResources: ContractResourceOption[] = fundingSources.map((src) => ({
    id: src.id,
    kind: "FUNDING",
    partyName: src.name,
    partyType: "COMPANY",
    role: "Production funder / investor",
    rate: src.amount != null ? zCurrency(src.amount) : "TBD",
    paymentTerms: src.terms || "Per agreed funding schedule and milestone reporting",
    startDate: toDateOnly(earliestDay),
    endDate: toDateOnly(latestDay),
    projectInvolvement: `Funding source for ${project.title}`,
    locationName: "N/A",
    equipmentList: "N/A",
    shootDaysCount: shootDaysCount > 0 ? String(shootDaysCount) : "TBD",
    serviceDuration: durationLabel,
    counterpartyUserId: null,
    castingTalentId: null,
    crewTeamId: null,
    locationListingId: null,
    vendorName: src.name,
    label: `${src.name}${src.amount != null ? ` · ${zCurrency(src.amount)}` : ""}`,
  }));

  return {
    project: {
      id: project.id,
      title: project.title,
      productionCompany,
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
      shootDaysCount,
    },
    resources: {
      actors: actorResources,
      crew: crewResources,
      locations: locationResources,
      equipment: equipmentResources,
      catering: cateringResources,
      funding: fundingResources,
    },
  };
}

export function findResourceInContext(
  context: ContractResourceContextPayload,
  resourceType: string,
  resourceId: string | null | undefined,
): ContractResourceOption | null {
  if (!resourceId) return null;
  const kind = resourceType.toUpperCase();
  if (kind === "ACTOR") return context.resources.actors.find((r) => r.id === resourceId) ?? null;
  if (kind === "CREW") return context.resources.crew.find((r) => r.id === resourceId) ?? null;
  if (kind === "LOCATION") return context.resources.locations.find((r) => r.id === resourceId) ?? null;
  if (kind === "EQUIPMENT") return context.resources.equipment.find((r) => r.id === resourceId) ?? null;
  if (kind === "CATERING") return context.resources.catering.find((r) => r.id === resourceId) ?? null;
  if (kind === "FUNDING") return context.resources.funding.find((r) => r.id === resourceId) ?? null;
  return null;
}
