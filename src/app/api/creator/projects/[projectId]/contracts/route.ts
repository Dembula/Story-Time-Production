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
import { sendProjectContract, logContractEvent, contractStatusLabel } from "@/lib/contract-lifecycle";
import type { RecipientType } from "@/lib/contract-lifecycle";
import { CONTRACT_TEMPLATE_CATALOG } from "@/lib/contract-template-catalog";
import { mergeClausesForContract } from "@/lib/legal/clause-library-service";
import { defaultContractApprovalChain } from "@/lib/legal/contract-approval-service";

interface Params {
  params: Promise<{ projectId: string }>;
}

function resourceTypeToRecipient(
  resourceType?: string | null,
): RecipientType | null {
  const map: Record<string, RecipientType> = {
    ACTOR: "CAST_MEMBER",
    CREW: "CREW_MEMBER",
    LOCATION: "LOCATION_OWNER",
    EQUIPMENT: "VENDOR",
    CATERING: "VENDOR",
    FUNDING: "INVESTOR",
    GENERAL: "MANUAL",
  };
  return resourceType ? map[resourceType] ?? null : null;
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
        events: { orderBy: { createdAt: "desc" }, take: 20 },
        approvalSteps: { orderBy: { stepOrder: "asc" }, include: { approver: { select: { id: true, name: true } } } },
        signers: { orderBy: { signOrder: "asc" } },
        castingTalent: { select: { id: true, name: true } },
        crewTeam: { select: { id: true, companyName: true } },
        locationListing: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        counterpartyUser: { select: { id: true, name: true, email: true } },
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
    catalog: CONTRACT_TEMPLATE_CATALOG,
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
      recipientType: c.recipientType,
      recipientLabel: c.recipientLabel,
      recipientEmail: c.recipientEmail,
      jurisdiction: c.jurisdiction,
      catalogEntryId: c.catalogEntryId,
      signingMode: c.signingMode,
      approvalRequired: c.approvalRequired,
      esignProvider: c.esignProvider,
      signatureDeadline: c.signatureDeadline?.toISOString() ?? null,
      sentAt: c.sentAt?.toISOString() ?? null,
      viewedAt: c.viewedAt?.toISOString() ?? null,
      executedAt: c.executedAt?.toISOString() ?? null,
      paymentTransactionId: c.paymentTransactionId,
      hireAmount: c.hireAmount,
      paidAt: c.paidAt?.toISOString() ?? null,
      salaryPayable:
        (c.type === "ACTOR" || c.type === "CREW") &&
        SIGNED_CONTRACT_STATUSES.has(c.status) &&
        !c.paymentTransactionId,
      statusLabel: contractStatusLabel(c.status),
      counterparty: c.counterpartyUser
        ? { id: c.counterpartyUser.id, name: c.counterpartyUser.name, email: c.counterpartyUser.email }
        : null,
      events: c.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      })),
      approvalSteps: c.approvalSteps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        status: s.status,
        approverRole: s.approverRole,
        approver: s.approver,
        comment: s.comment,
        decidedAt: s.decidedAt?.toISOString() ?? null,
      })),
      signers: c.signers.map((s) => ({
        id: s.id,
        partyRole: s.partyRole,
        label: s.label,
        email: s.email,
        signOrder: s.signOrder,
        status: s.status,
        required: s.required,
        signedAt: s.signedAt?.toISOString() ?? null,
      })),
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
        recipientType?: RecipientType | null;
        recipientLabel?: string | null;
        recipientEmail?: string | null;
        jurisdiction?: string | null;
        signatureDeadline?: string | null;
        terms?: string;
        fields?: Record<string, string>;
        templateBody?: string | null;
        customClauses?: string | null;
        clauseIds?: string[];
        catalogEntryId?: string | null;
        signingMode?: "PARALLEL" | "SEQUENTIAL";
        approvalRequired?: boolean;
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

  const jurisdiction = body.jurisdiction ?? "South Africa";
  const mergedFields = await mergeClausesForContract({
    projectId,
    jurisdiction,
    fields: mergeFieldValues(
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
    ),
    clauseIds: body.clauseIds,
  });

  const termsForVersion =
    body.terms?.trim() ||
    buildTermsFromBody(templateType, mergedFields, body.templateBody ?? template.body);

  const contractType = body.type ?? template.type;
  const recipientLabel =
    body.recipientLabel?.trim() ||
    selectedResource?.partyName ||
    body.vendorName?.trim() ||
    null;

  const contract = await prisma.projectContract.create({
    data: {
      projectId,
      type: contractType,
      status: CONTRACT_STATUS.DRAFT,
      subject:
        body.subject ??
        `${template.label}${selectedResource?.partyName ? ` · ${selectedResource.partyName}` : body.vendorName ? ` · ${body.vendorName}` : ""}`,
      counterpartyUserId: body.counterpartyUserId ?? selectedResource?.counterpartyUserId ?? null,
      recipientType: body.recipientType ?? (resourceTypeToRecipient(body.resourceType) ?? null),
      recipientLabel,
      recipientEmail: body.recipientEmail?.trim() || null,
      jurisdiction,
      catalogEntryId: body.catalogEntryId ?? null,
      signingMode: body.signingMode ?? "PARALLEL",
      approvalRequired: body.approvalRequired ?? false,
      signatureDeadline: body.signatureDeadline ? new Date(body.signatureDeadline) : null,
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

  await logContractEvent(contract.id, "CREATED", {
    userId,
    detail: "Generated from legal template + production data",
  });

  if (body.approvalRequired) {
    await defaultContractApprovalChain(projectId, contract.id);
  }

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId,
      type: "CONTRACT_DRAFT_CREATED",
      message: `${template.label} created.`,
      metadata: JSON.stringify({
        contractId: contract.id,
        type: contract.type,
        status: CONTRACT_STATUS.DRAFT,
      }),
    },
  });

  if (body.sendContract) {
    try {
      await sendProjectContract(contract.id, userId);
      await prisma.projectActivity.create({
        data: {
          projectId,
          userId,
          type: "CONTRACT_SENT",
          message: `${template.label} sent for signature.`,
          metadata: JSON.stringify({ contractId: contract.id }),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send contract";
      return NextResponse.json({ error: message, contract }, { status: 400 });
    }
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
  } else if (body.status !== undefined && body.status.toUpperCase() !== CONTRACT_STATUS.SENT) {
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
    return NextResponse.json(
      { error: "Use counter-sign endpoint after recipient signature." },
      { status: 400 },
    );
  }

  if (body.status && body.status.toUpperCase() === CONTRACT_STATUS.SENT) {
    try {
      await sendProjectContract(body.id, userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send contract";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else if (body.status || body.reopenAsDraft) {
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
