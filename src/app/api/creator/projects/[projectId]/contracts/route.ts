import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, type EquipmentMarketMeta } from "@/lib/marketplace-profile-meta";
import {
  CONTRACT_STATUS,
  SIGNED_CONTRACT_STATUSES,
  getContractTemplates,
  getDefaultDisclaimer,
  getTemplateByType,
  getTemplatePlaceholders,
  mapLegacyContractType,
  renderTemplate,
  statusToTone,
  type ContractTemplateType,
} from "@/lib/contract-template-engine";

interface Params {
  params: Promise<{ projectId: string }>;
}

const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";
const NEED_LINK_MARKER_PREFIX = "crewNeedId:";

function zCurrency(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return "TBD";
  return `R${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "TBD";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toISOString().slice(0, 10);
}

async function buildContractResourceContext(projectId: string, creatorId: string) {
  const [project, budget, actorRoles, crewNeeds, locationBreakdowns, equipmentItems] = await Promise.all([
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
    prisma.projectBudget.findUnique({
      where: { projectId },
      include: { lines: true },
    }),
    prisma.castingRole.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        invitations: {
          where: { status: "ACCEPTED" },
          orderBy: { respondedAt: "desc" },
          take: 1,
          include: { talent: { include: { castingAgency: true } } },
        },
      },
    }),
    prisma.crewRoleNeed.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
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
  ]);

  if (!project) return null;

  const earliestDay = project.shootDays[0]?.date ?? null;
  const latestDay = project.shootDays[project.shootDays.length - 1]?.date ?? null;
  const productionCompany =
    project.pitches[0]?.productionCompany ||
    project.pitches[0]?.creator?.name ||
    "Story Time Production";

  const actorResources = actorRoles.map((role) => {
    const accepted = role.invitations[0];
    const talent = accepted?.talent ?? null;
    const marker = `${ROLE_LINK_MARKER_PREFIX}${role.id}`;
    const line = budget?.lines.find((l) => (l.notes ?? "").includes(marker));
    return {
      id: role.id,
      kind: "ACTOR" as const,
      partyName: talent?.name ?? role.name,
      partyType: talent?.castingAgency?.agencyName ? "COMPANY" : "INDIVIDUAL",
      role: role.name,
      rate: zCurrency(line?.unitCost ?? null),
      paymentTerms: "Per project schedule and approved payroll cycle",
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
      projectInvolvement: role.description || "Included in casting schedule and shoot plan",
      locationName: "N/A",
      equipmentList: "N/A",
      counterpartyUserId: null as string | null,
      castingTalentId: talent?.id ?? null,
      crewTeamId: null as string | null,
      locationListingId: null as string | null,
      vendorName: talent?.castingAgency?.agencyName ?? null,
      label: `${role.name} · ${talent?.name ?? "Unassigned actor"}`,
    };
  });

  const creatorCrew = await prisma.creatorCrewRoster.findMany({
    where: { creatorId },
    orderBy: { updatedAt: "desc" },
  });

  const crewResources = crewNeeds.map((need) => {
    const marker = `${NEED_LINK_MARKER_PREFIX}${need.id}`;
    const budgetLine = budget?.lines.find((l) => (l.notes ?? "").includes(marker));
    const roster = creatorCrew.find((m) => (m.notes ?? "").includes(marker));
    return {
      id: need.id,
      kind: "CREW" as const,
      partyName: roster?.name ?? need.role,
      partyType: "INDIVIDUAL",
      role: `${need.department ?? "Crew"} / ${need.role}`,
      rate: zCurrency(budgetLine?.unitCost ?? null),
      paymentTerms: "Per timesheet approval and production payroll terms",
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
      projectInvolvement: `Assigned need: ${need.role}`,
      locationName: "N/A",
      equipmentList: "N/A",
      counterpartyUserId: null as string | null,
      castingTalentId: null as string | null,
      crewTeamId: null as string | null,
      locationListingId: null as string | null,
      vendorName: null as string | null,
      label: `${need.role} · ${roster?.name ?? "Unassigned crew"}`,
    };
  });

  const locationResources = locationBreakdowns
    .filter((loc) => loc.locationListing)
    .map((loc) => {
      const listing = loc.locationListing!;
      const booking = listing.bookings[0];
      return {
        id: loc.id,
        kind: "LOCATION" as const,
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
        counterpartyUserId: listing.companyId ?? null,
        castingTalentId: null as string | null,
        crewTeamId: null as string | null,
        locationListingId: listing.id,
        vendorName: null as string | null,
        label: `${listing.name} · ${loc.name}`,
      };
    });

  const equipmentResources = equipmentItems
    .filter((item) => item.equipmentListing)
    .map((item) => {
      const listing = item.equipmentListing!;
      const meta = parseEmbeddedMeta<EquipmentMarketMeta>(listing.description);
      const req = listing.requests[0];
      return {
        id: item.id,
        kind: "EQUIPMENT" as const,
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
        counterpartyUserId: listing.companyId ?? null,
        castingTalentId: null as string | null,
        crewTeamId: null as string | null,
        locationListingId: null as string | null,
        vendorName: listing.companyName,
        label: `${listing.companyName} · ${item.category} x${item.quantity}`,
        equipmentListingId: listing.id,
      };
    });

  return {
    project: {
      id: project.id,
      title: project.title,
      productionCompany,
      startDate: toDateOnly(earliestDay),
      endDate: toDateOnly(latestDay),
    },
    resources: {
      actors: actorResources,
      crew: crewResources,
      locations: locationResources,
      equipment: equipmentResources,
    },
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const [contracts, context] = await Promise.all([
    prisma.projectContract.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
        signatures: true,
        castingTalent: { select: { id: true, name: true } },
        crewTeam: { select: { id: true, companyName: true } },
        locationListing: { select: { id: true, name: true } },
      },
    }),
    buildContractResourceContext(projectId, access.userId!),
  ]);

  const signed = contracts.filter((c) => SIGNED_CONTRACT_STATUSES.has(c.status)).length;
  const sent = contracts.filter((c) => c.status === CONTRACT_STATUS.SENT || c.status === CONTRACT_STATUS.VIEWED).length;
  const drafts = contracts.filter((c) => c.status === CONTRACT_STATUS.DRAFT).length;
  const needsSignature = contracts.filter((c) => !SIGNED_CONTRACT_STATUSES.has(c.status)).length;

  return NextResponse.json({
    templates: getContractTemplates().map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      body: t.body,
      placeholders: getTemplatePlaceholders(t.body),
    })),
    defaultDisclaimer: getDefaultDisclaimer(),
    resourceContext: context,
    metrics: {
      total: contracts.length,
      signed,
      sent,
      drafts,
      unconfirmed: needsSignature,
    },
    contracts: contracts.map((c) => ({
      id: c.id,
      type: c.type,
      normalizedType: mapLegacyContractType(c.type),
      status: c.status,
      statusTone: statusToTone(c.status),
      subject: c.subject,
      createdAt: c.createdAt,
      latestVersion: c.versions[0]
        ? {
            id: c.versions[0].id,
            version: c.versions[0].version,
            terms: c.versions[0].terms,
            createdAt: c.versions[0].createdAt,
          }
        : null,
      signaturesCount: c.signatures.length,
      actor: c.castingTalent ? { id: c.castingTalent.id, name: c.castingTalent.name } : null,
      crewTeam: c.crewTeam ? { id: c.crewTeam.id, name: c.crewTeam.companyName } : null,
      location:
        c.locationListing && "name" in c.locationListing
          ? { id: c.locationListing.id, name: (c.locationListing as any).name as string }
          : null,
      vendorName: c.vendorName,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        type?: string;
        templateType?: ContractTemplateType;
        resourceType?: "ACTOR" | "CREW" | "LOCATION" | "EQUIPMENT" | "GENERAL";
        resourceId?: string | null;
        subject?: string | null;
        counterpartyUserId?: string | null;
        castingTalentId?: string | null;
        crewTeamId?: string | null;
        locationListingId?: string | null;
        vendorName?: string | null;
        terms?: string;
        templateBody?: string | null;
        customClauses?: string | null;
        paymentTerms?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        rate?: string | null;
        role?: string | null;
        sendContract?: boolean;
      }
    | null;

  if (!body?.type && !body?.templateType) {
    return NextResponse.json({ error: "Missing type/templateType" }, { status: 400 });
  }

  const templateType = body.templateType ?? mapLegacyContractType(body.type!);
  const template = getTemplateByType(templateType);
  const resourceContext = await buildContractResourceContext(projectId, userId);
  if (!resourceContext) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const selectedResource =
    body.resourceType === "ACTOR"
      ? resourceContext.resources.actors.find((r) => r.id === body.resourceId)
      : body.resourceType === "CREW"
      ? resourceContext.resources.crew.find((r) => r.id === body.resourceId)
      : body.resourceType === "LOCATION"
      ? resourceContext.resources.locations.find((r) => r.id === body.resourceId)
      : body.resourceType === "EQUIPMENT"
      ? resourceContext.resources.equipment.find((r) => r.id === body.resourceId)
      : null;

  const termsForVersion =
    body.terms?.trim() ||
    renderTemplate(body.templateBody?.trim() || template.body, {
      production_name: resourceContext.project.title,
      production_company: resourceContext.project.productionCompany,
      party_name: selectedResource?.partyName ?? body.vendorName ?? "TBD",
      party_type: selectedResource?.partyType ?? "INDIVIDUAL",
      role: body.role ?? selectedResource?.role ?? "General Services",
      rate: body.rate ?? selectedResource?.rate ?? "TBD",
      payment_terms: body.paymentTerms ?? selectedResource?.paymentTerms ?? "As agreed between parties",
      start_date: body.startDate ?? selectedResource?.startDate ?? resourceContext.project.startDate,
      end_date: body.endDate ?? selectedResource?.endDate ?? resourceContext.project.endDate,
      project_involvement: selectedResource?.projectInvolvement ?? "Defined in schedule",
      location_name: selectedResource?.locationName ?? "N/A",
      equipment_list: selectedResource?.equipmentList ?? "N/A",
      custom_clauses: body.customClauses ?? "None specified.",
      legal_disclaimer: getDefaultDisclaimer(),
    });

  const contractType = body.type ?? template.type;
  const initialStatus = body.sendContract ? CONTRACT_STATUS.SENT : CONTRACT_STATUS.DRAFT;

  const contract = await prisma.projectContract.create({
    data: {
      projectId,
      type: contractType,
      status: initialStatus,
      subject:
        body.subject ??
        `${template.label} · ${selectedResource?.partyName ?? body.vendorName ?? "Counterparty"}`,
      counterpartyUserId: body.counterpartyUserId ?? selectedResource?.counterpartyUserId ?? null,
      castingTalentId: body.castingTalentId ?? selectedResource?.castingTalentId ?? null,
      crewTeamId: body.crewTeamId ?? selectedResource?.crewTeamId ?? null,
      locationListingId: body.locationListingId ?? selectedResource?.locationListingId ?? null,
      vendorName: body.vendorName ?? selectedResource?.vendorName ?? null,
      createdById: userId,
    },
  });

  const version = await prisma.projectContractVersion.create({
    data: {
      contractId: contract.id,
      version: 1,
      terms: termsForVersion,
      changeNotes: "Auto-generated from legal template + production data",
      createdById: userId,
    },
  });
  await prisma.projectContract.update({
    where: { id: contract.id },
    data: { currentVersionId: version.id },
  });

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId,
      type: body.sendContract ? "CONTRACT_SENT" : "CONTRACT_DRAFT_CREATED",
      message: `${template.label} created${body.sendContract ? " and sent" : ""}.`,
      metadata: JSON.stringify({
        contractId: contract.id,
        type: contract.type,
        status: initialStatus,
      }),
    },
  });

  if (initialStatus === CONTRACT_STATUS.SENT && contract.counterpartyUserId) {
    await prisma.notification.create({
      data: {
        userId: contract.counterpartyUserId,
        type: "CONTRACT_EVENT",
        title: "New contract received",
        body: `You received ${template.label} for project ${resourceContext.project.title}.`,
        metadata: JSON.stringify({
          projectId,
          contractId: contract.id,
          status: initialStatus,
        }),
      },
    });
  }

  const updated = await prisma.projectContract.findUnique({
    where: { id: contract.id },
    include: { versions: true },
  });

  return NextResponse.json({ contract: updated ?? contract }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        subject?: string | null;
        status?: string;
        terms?: string;
        changeNotes?: string | null;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.projectContract.findFirst({
    where: { id: body.id, projectId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const updateData: { subject?: string; status?: string } = {};
  if (body.subject !== undefined) updateData.subject = body.subject ?? undefined;
  if (body.status !== undefined) updateData.status = body.status;

  await prisma.projectContract.update({
    where: { id: body.id },
    data: updateData,
  });

  if (body.terms !== undefined) {
    const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
    const version = await prisma.projectContractVersion.create({
      data: {
        contractId: body.id,
        version: nextVersion,
        terms: body.terms,
        changeNotes: body.changeNotes ?? null,
        createdById: userId,
      },
    });
    await prisma.projectContract.update({
      where: { id: body.id },
      data: { currentVersionId: version.id },
    });
  }

  if (body.status && body.status.toUpperCase() === CONTRACT_STATUS.ACCEPTED) {
    await prisma.projectContract.update({
      where: { id: body.id },
      data: { status: CONTRACT_STATUS.SIGNED },
    });
    const fresh = await prisma.projectContract.findUnique({
      where: { id: body.id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (fresh?.versions[0]) {
      await prisma.projectSignature.create({
        data: {
          contractId: fresh.id,
          versionId: fresh.versions[0].id,
          userId,
          name: "Story Time Platform Signature",
          role: "Creator",
        },
      });
    }
  }

  if (body.status) {
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "CONTRACT_STATUS_UPDATED",
        message: `Contract status updated to ${body.status}.`,
        metadata: JSON.stringify({ contractId: body.id, status: body.status }),
      },
    });
  }

  const contract = await prisma.projectContract.findUnique({
    where: { id: body.id },
    include: { versions: { orderBy: { version: "desc" } }, signatures: true },
  });

  return NextResponse.json({ contract });
}
