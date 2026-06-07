import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_STATUS,
  SIGNED_CONTRACT_STATUSES,
  getContractTemplates,
  getDefaultDisclaimer,
  getTemplateByType,
  getTemplatePlaceholders,
  mapLegacyContractType,
  statusToTone,
  type ContractTemplateType,
} from "@/lib/contract-template-engine";
import {
  buildRenderedContract,
  emptyFieldValues,
  mergeFieldValues,
  projectFieldValues,
  resourceFieldValues,
  isContractEditable,
} from "@/lib/contract-prefill";
import {
  buildContractResourceContext,
  findResourceInContext,
} from "@/lib/contract-resource-context";

interface Params {
  params: Promise<{ projectId: string }>;
}

function buildTermsFromBody(
  templateType: ContractTemplateType,
  fields: Record<string, string>,
  templateBodyOverride?: string | null,
) {
  return buildRenderedContract(templateType, mergeFieldValues(emptyFieldValues(), fields), templateBodyOverride ?? undefined);
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
        versions: { orderBy: { version: "desc" } },
        signatures: { orderBy: { signedAt: "asc" } },
        castingTalent: { select: { id: true, name: true } },
        crewTeam: { select: { id: true, companyName: true } },
        locationListing: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    buildContractResourceContext(projectId, access.userId!),
  ]);

  const signed = contracts.filter((c) => SIGNED_CONTRACT_STATUSES.has(c.status)).length;
  const sent = contracts.filter((c) => c.status === CONTRACT_STATUS.SENT || c.status === CONTRACT_STATUS.VIEWED).length;
  const drafts = contracts.filter((c) => c.status === CONTRACT_STATUS.DRAFT).length;
  const rejected = contracts.filter((c) => c.status === CONTRACT_STATUS.REJECTED).length;
  const needsSignature = contracts.filter((c) => !SIGNED_CONTRACT_STATUSES.has(c.status)).length;

  return NextResponse.json({
    templates: getContractTemplates().map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      body: t.body,
      placeholders: getTemplatePlaceholders(t.body),
      resourceKinds: t.resourceKinds,
      legalReferences: t.legalReferences,
    })),
    defaultDisclaimer: getDefaultDisclaimer(),
    resourceContext: context,
    metrics: {
      total: contracts.length,
      signed,
      sent,
      drafts,
      rejected,
      unconfirmed: needsSignature,
    },
    contracts: contracts.map((c) => ({
      id: c.id,
      type: c.type,
      normalizedType: mapLegacyContractType(c.type),
      status: c.status,
      statusTone: statusToTone(c.status),
      editable: isContractEditable(c.status),
      viewOnly: SIGNED_CONTRACT_STATUSES.has(c.status),
      subject: c.subject,
      createdAt: c.createdAt,
      latestVersion: c.versions[0]
        ? {
            id: c.versions[0].id,
            version: c.versions[0].version,
            terms: c.versions[0].terms,
            changeNotes: c.versions[0].changeNotes,
            createdAt: c.versions[0].createdAt,
          }
        : null,
      versions: c.versions.map((v) => ({
        id: v.id,
        version: v.version,
        changeNotes: v.changeNotes,
        createdAt: v.createdAt,
      })),
      signatures: c.signatures.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        signedAt: s.signedAt,
      })),
      signaturesCount: c.signatures.length,
      actor: c.castingTalent ? { id: c.castingTalent.id, name: c.castingTalent.name } : null,
      crewTeam: c.crewTeam ? { id: c.crewTeam.id, name: c.crewTeam.companyName } : null,
      location:
        c.locationListing && "name" in c.locationListing
          ? { id: c.locationListing.id, name: (c.locationListing as { name: string }).name }
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
        resourceType?: "ACTOR" | "CREW" | "LOCATION" | "EQUIPMENT" | "CATERING" | "FUNDING" | "GENERAL";
        resourceId?: string | null;
        subject?: string | null;
        counterpartyUserId?: string | null;
        castingTalentId?: string | null;
        crewTeamId?: string | null;
        locationListingId?: string | null;
        vendorName?: string | null;
        terms?: string;
        fields?: Record<string, string>;
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

  const selectedResource = findResourceInContext(
    resourceContext,
    body.resourceType ?? "GENERAL",
    body.resourceId,
  );

  const mergedFields = mergeFieldValues(
    emptyFieldValues(),
    projectFieldValues(resourceContext.project),
    selectedResource ? resourceFieldValues(selectedResource) : {},
    body.fields ?? {},
    {
      role: body.role ?? undefined,
      rate: body.rate ?? undefined,
      payment_terms: body.paymentTerms ?? undefined,
      start_date: body.startDate ?? undefined,
      end_date: body.endDate ?? undefined,
      custom_clauses: body.customClauses ?? undefined,
      party_name: body.vendorName ?? undefined,
    },
  );

  const termsForVersion =
    body.terms?.trim() ||
    buildTermsFromBody(templateType, mergedFields, body.templateBody ?? template.body);

  const contractType = body.type ?? template.type;
  const initialStatus = body.sendContract ? CONTRACT_STATUS.SENT : CONTRACT_STATUS.DRAFT;

  const contract = await prisma.projectContract.create({
    data: {
      projectId,
      type: contractType,
      status: initialStatus,
      subject:
        body.subject ??
        `${template.label}${selectedResource?.partyName ? ` · ${selectedResource.partyName}` : body.vendorName ? ` · ${body.vendorName}` : ""}`,
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
      changeNotes: "Generated from legal template + production data",
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
    include: { versions: true, signatures: true },
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
        reopenAsDraft?: boolean;
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

  const isSigned = SIGNED_CONTRACT_STATUSES.has(existing.status);
  if (isSigned && (body.terms !== undefined || body.reopenAsDraft)) {
    return NextResponse.json(
      { error: "Signed contracts cannot be edited. View or download only." },
      { status: 403 },
    );
  }

  if (body.terms !== undefined && !isContractEditable(existing.status) && !body.reopenAsDraft) {
    return NextResponse.json(
      { error: "Only draft, rejected, or changes-requested contracts can be edited." },
      { status: 403 },
    );
  }

  const updateData: { subject?: string; status?: string } = {};
  if (body.subject !== undefined) updateData.subject = body.subject ?? undefined;

  if (body.reopenAsDraft && (existing.status === CONTRACT_STATUS.REJECTED || existing.status === CONTRACT_STATUS.CHANGES_REQUESTED)) {
    updateData.status = CONTRACT_STATUS.DRAFT;
  } else if (body.status !== undefined) {
    updateData.status = body.status;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.projectContract.update({
      where: { id: body.id },
      data: updateData,
    });
  }

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
      data: { currentVersionId: version.id, status: updateData.status ?? CONTRACT_STATUS.DRAFT },
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

  if (body.status || body.reopenAsDraft) {
    await prisma.projectActivity.create({
      data: {
        projectId,
        userId,
        type: "CONTRACT_STATUS_UPDATED",
        message: `Contract status updated.`,
        metadata: JSON.stringify({ contractId: body.id, status: updateData.status ?? body.status }),
      },
    });
  }

  const contract = await prisma.projectContract.findUnique({
    where: { id: body.id },
    include: { versions: { orderBy: { version: "desc" } }, signatures: true },
  });

  return NextResponse.json({ contract });
}
