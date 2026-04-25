import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  composeFundingDetails,
  fundingOpportunityCatalogue,
  fundingTypeLabel,
  parseFundingDetails,
  type FundingAllocation,
  type FundingApplicationRecord,
  type FundingHubStructured,
  type FundingMilestone,
  type FundingSourceRecord,
  type FundingSourceType,
} from "@/lib/funding-hub-db";
import { getTemplateByType, renderTemplate } from "@/lib/contract-template-engine";

interface Params {
  params: Promise<{ projectId: string }>;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isoNow() {
  return new Date().toISOString();
}

function summarizeFundingStage(
  secured: number,
  required: number,
  appCount: number,
  inProduction: boolean,
): FundingHubStructured["fundingStatus"] {
  if (inProduction) return "IN_PRODUCTION";
  if (secured <= 0 && appCount <= 0) return "NOT_FUNDED";
  if (appCount > 0 && secured <= 0) return "IN_APPLICATION";
  if (secured > 0 && required > 0 && secured < required) return "PARTIALLY_FUNDED";
  if (required > 0 && secured >= required) return "FULLY_FUNDED";
  return "SEEKING_FUNDING";
}

function readinessScore(params: {
  scriptCount: number;
  sceneCount: number;
  budgetLineCount: number;
  castCount: number;
  crewCount: number;
  shootDayCount: number;
}) {
  const scriptReadiness = params.scriptCount > 0 ? (params.sceneCount > 0 ? 100 : 60) : 0;
  const budgetReadiness = params.budgetLineCount > 0 ? 100 : 0;
  const teamReadiness = params.castCount + params.crewCount > 0 ? Math.min(100, (params.castCount + params.crewCount) * 12) : 0;
  const scheduleReadiness = params.shootDayCount > 0 ? Math.min(100, params.shootDayCount * 20) : 0;
  const score = Math.round(
    scriptReadiness * 0.3 + budgetReadiness * 0.25 + teamReadiness * 0.2 + scheduleReadiness * 0.25,
  );
  return {
    score,
    breakdown: {
      scriptReadiness,
      budgetReadiness,
      teamReadiness,
      scheduleReadiness,
    },
  };
}

function opportunityMatchScore(opportunity: ReturnType<typeof fundingOpportunityCatalogue>[number], params: {
  genre: string | null;
  budget: number;
  secured: number;
}) {
  let score = 0;
  const needed = Math.max(0, params.budget - params.secured);
  if (needed >= opportunity.minAmount && needed <= opportunity.maxAmount) score += 50;
  else if (needed > 0 && needed <= opportunity.maxAmount * 1.2) score += 30;
  if (params.genre) {
    const g = params.genre.toUpperCase().replace(/\s+/g, "_");
    if (opportunity.categories.some((c) => c.toUpperCase().includes(g))) score += 25;
  }
  if (!opportunity.region || opportunity.region.toLowerCase().includes("africa")) score += 10;
  if (opportunity.type === "INTERNAL_STORYTIME") score += 8;
  return Math.min(100, score);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const [funding, project, budget, contracts, milestones] = await Promise.all([
    prisma.fundingRequest.findUnique({ where: { projectId } }),
    prisma.originalProject.findUnique({
      where: { id: projectId },
      include: {
        scripts: { select: { id: true } },
        scenes: { select: { id: true } },
        shootDays: { select: { id: true, status: true } },
        pitches: { include: { creator: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 1 },
        members: { select: { id: true } },
        castingRoles: { select: { id: true } },
        crewRoleNeeds: { select: { id: true } },
      },
    }),
    prisma.projectBudget.findUnique({
      where: { projectId },
      include: { lines: true },
    }),
    prisma.projectContract.findMany({
      where: { projectId },
      select: { id: true, type: true, status: true, subject: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectActivity.findMany({
      where: { projectId, type: { in: ["FUNDING_PAYOUT_DUE", "FUNDING_PAYOUT_MISSED"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseFundingDetails(funding?.details);
  const structured = parsed.structured;
  const budgetTotal =
    budget?.totalPlanned ??
    budget?.lines.reduce((sum, line) => sum + num(line.total), 0) ??
    num(project.budget, 0);
  const securedFromSources = structured.sources.reduce((sum, src) => sum + num(src.amountCommitted), 0);
  const receivedFromSources = structured.sources.reduce((sum, src) => sum + num(src.amountReceived), 0);
  const headlineAmount = num(funding?.amount, 0);
  const securedTotal = Math.max(securedFromSources, headlineAmount);
  const fundingRequired = Math.max(0, budgetTotal);
  const fundingGap = Math.max(0, fundingRequired - securedTotal);
  const percentFunded = fundingRequired > 0 ? Math.min(100, Math.round((securedTotal / fundingRequired) * 100)) : 0;

  const readiness = readinessScore({
    scriptCount: project.scripts.length,
    sceneCount: project.scenes.length,
    budgetLineCount: budget?.lines.length ?? 0,
    castCount: project.castingRoles.length,
    crewCount: project.crewRoleNeeds.length + project.members.length,
    shootDayCount: project.shootDays.length,
  });

  const opportunities = fundingOpportunityCatalogue()
    .map((opp) => ({
      ...opp,
      matchScore: opportunityMatchScore(opp, {
        genre: project.genre ?? null,
        budget: fundingRequired,
        secured: securedTotal,
      }),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const minThreshold = Math.max(0, Math.min(100, num(structured.minimumStartThresholdPercent, 35)));
  const productionStartAllowed = percentFunded >= minThreshold;
  const allocationTotal = structured.allocations.reduce((sum, a) => sum + num(a.amount), 0);
  const overspendRisk = allocationTotal > securedTotal;

  const now = Date.now();
  const milestoneAlerts = structured.sources.flatMap((source) =>
    source.milestones
      .filter((m) => !m.paid && m.dueDate)
      .map((m) => {
        const due = new Date(m.dueDate!).getTime();
        const deltaDays = Math.ceil((due - now) / 86400000);
        return {
          sourceId: source.id,
          sourceName: source.name,
          milestoneId: m.id,
          phase: m.phase,
          amount: m.amount,
          dueDate: m.dueDate,
          alert: deltaDays < 0 ? "MISSED" : deltaDays <= 7 ? "UPCOMING" : "NONE",
          deltaDays,
        };
      })
      .filter((m) => m.alert !== "NONE"),
  );

  const fundingStatus = summarizeFundingStage(
    securedTotal,
    fundingRequired,
    structured.applications.filter((a) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(a.status)).length,
    project.status === "IN_PRODUCTION" || project.phase === "PRODUCTION",
  );

  return NextResponse.json({
    funding: funding ?? null,
    parsedDetails: {
      notes: parsed.plain,
      structured,
    },
    projectFundingProfile: {
      budgetTotal,
      fundingRequired,
      fundingSecured: securedTotal,
      fundingReceived: receivedFromSources,
      fundingGap,
      percentFunded,
      allocationTotal,
      overspendRisk,
      status: fundingStatus,
      minimumStartThresholdPercent: minThreshold,
      productionStartAllowed,
      scheduleGateReason: productionStartAllowed
        ? null
        : `Minimum ${minThreshold}% funding threshold not met for production start.`,
    },
    readiness,
    opportunities,
    applications: structured.applications,
    sources: structured.sources,
    allocations: structured.allocations,
    contractSummary: {
      total: contracts.length,
      signed: contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED"].includes(c.status)).length,
      relatedToFunding: contracts.filter((c) =>
        (c.subject ?? "").toLowerCase().includes("fund") || c.type.toUpperCase().includes("FUNDING"),
      ).length,
    },
    milestoneAlerts,
    payoutEvents: milestones.map((m) => ({
      id: m.id,
      type: m.type,
      message: m.message,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        option: "HAS_FUNDING" | "REQUEST_FUNDING";
        amount?: number | null;
        currency?: string | null;
        details?: string | null;
      }
    | null;

  if (!body?.option) {
    return NextResponse.json({ error: "Missing option" }, { status: 400 });
  }

  const funding = await prisma.fundingRequest.upsert({
    where: { projectId },
    create: {
      projectId,
      option: body.option,
      amount: body.amount ?? null,
      currency: body.currency ?? "ZAR",
      details: composeFundingDetails(body.details ?? null, {
        legalDisclaimer:
          "Funding terms are customizable and should be reviewed by qualified legal and financial advisors.",
        fundingStatus: body.option === "HAS_FUNDING" ? "PARTIALLY_FUNDED" : "SEEKING_FUNDING",
        minimumStartThresholdPercent: 35,
        sources: [],
        applications: [],
        allocations: [],
      }),
      status: "SEEKING_FUNDING",
    },
    update: {
      option: body.option,
      amount: body.amount ?? null,
      currency: body.currency ?? "ZAR",
      details: body.details ?? undefined,
    },
  });

  return NextResponse.json({ funding }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        option?: "HAS_FUNDING" | "REQUEST_FUNDING";
        amount?: number | null;
        currency?: string | null;
        details?: string | null;
        action?:
          | "SAVE_SNAPSHOT"
          | "ADD_SOURCE"
          | "UPDATE_SOURCE"
          | "ADD_APPLICATION"
          | "UPDATE_APPLICATION"
          | "ADD_ALLOCATION"
          | "UPDATE_SETTINGS"
          | "LINK_SOURCE_CONTRACT";
        source?: Partial<FundingSourceRecord> & { id?: string };
        application?: Partial<FundingApplicationRecord> & { id?: string };
        allocation?: Partial<FundingAllocation> & { id?: string };
        settings?: {
          minimumStartThresholdPercent?: number | null;
          legalDisclaimer?: string | null;
        };
        contractForSourceId?: string | null;
      }
    | null;

  const existing = await prisma.fundingRequest.findUnique({ where: { projectId } });

  if (!existing) {
    return NextResponse.json({ error: "No funding request for this project" }, { status: 404 });
  }

  const parsed = parseFundingDetails(existing.details);
  let structured = parsed.structured;
  let plainDetails = body?.details !== undefined ? body.details : parsed.plain;

  if (body?.action === "ADD_SOURCE" && body.source?.name && body.source?.type && body.source?.instrument) {
    const newSource: FundingSourceRecord = {
      id: uid("src"),
      name: body.source.name,
      type: body.source.type as FundingSourceType,
      instrument: body.source.instrument as any,
      amountCommitted: num(body.source.amountCommitted),
      amountReceived: num(body.source.amountReceived),
      paymentSchedule: body.source.paymentSchedule ?? null,
      conditions: body.source.conditions ?? null,
      linkedContractId: null,
      status: num(body.source.amountReceived) >= num(body.source.amountCommitted) ? "RECEIVED" : "COMMITTED",
      notes: body.source.notes ?? null,
      milestones: [],
    };
    structured = { ...structured, sources: [newSource, ...structured.sources] };
  } else if (body?.action === "UPDATE_SOURCE" && body.source?.id) {
    structured = {
      ...structured,
      sources: structured.sources.map((s) => {
        if (s.id !== body.source!.id) return s;
        const milestones =
          Array.isArray(body.source?.milestones) && body.source?.milestones.length > 0
            ? (body.source.milestones as FundingMilestone[])
            : s.milestones;
        const nextCommitted = body.source?.amountCommitted !== undefined ? num(body.source.amountCommitted) : s.amountCommitted;
        const nextReceived = body.source?.amountReceived !== undefined ? num(body.source.amountReceived) : s.amountReceived;
        return {
          ...s,
          ...body.source,
          amountCommitted: nextCommitted,
          amountReceived: nextReceived,
          status: nextReceived >= nextCommitted ? "RECEIVED" : nextReceived > 0 ? "PARTIALLY_RECEIVED" : "COMMITTED",
          milestones,
        };
      }),
    };
  } else if (body?.action === "ADD_APPLICATION" && body.application?.opportunityId) {
    const application: FundingApplicationRecord = {
      id: uid("app"),
      opportunityId: body.application.opportunityId,
      funderName: body.application.funderName ?? "Unknown funder",
      funderType: (body.application.funderType as FundingSourceType) ?? "INSTITUTIONAL",
      requestedAmount: num(body.application.requestedAmount),
      status: (body.application.status as any) ?? "SUBMITTED",
      submittedAt: isoNow(),
      documents: {
        pitchDeck: !!body.application.documents?.pitchDeck,
        script: !!body.application.documents?.script,
        budget: !!body.application.documents?.budget,
        productionPlan: !!body.application.documents?.productionPlan,
        teamDetails: !!body.application.documents?.teamDetails,
      },
      notes: body.application.notes ?? null,
    };
    structured = { ...structured, applications: [application, ...structured.applications] };
  } else if (body?.action === "UPDATE_APPLICATION" && body.application?.id) {
    structured = {
      ...structured,
      applications: structured.applications.map((a) => (a.id === body.application!.id ? { ...a, ...body.application } as FundingApplicationRecord : a)),
    };
  } else if (body?.action === "ADD_ALLOCATION" && body.allocation?.department) {
    const allocation: FundingAllocation = {
      id: uid("alloc"),
      department: body.allocation.department,
      amount: num(body.allocation.amount),
      note: body.allocation.note ?? null,
    };
    structured = { ...structured, allocations: [allocation, ...structured.allocations] };
  } else if (body?.action === "UPDATE_SETTINGS") {
    structured = {
      ...structured,
      minimumStartThresholdPercent:
        body.settings?.minimumStartThresholdPercent !== undefined
          ? num(body.settings.minimumStartThresholdPercent, 35)
          : structured.minimumStartThresholdPercent,
      legalDisclaimer:
        body.settings?.legalDisclaimer !== undefined
          ? body.settings.legalDisclaimer
          : structured.legalDisclaimer,
    };
  } else if (body?.action === "LINK_SOURCE_CONTRACT" && body.contractForSourceId) {
    const source = structured.sources.find((s) => s.id === body.contractForSourceId);
    if (!source) {
      return NextResponse.json({ error: "Funding source not found" }, { status: 404 });
    }
    const access = await ensureProjectAccess(projectId);
    if (access.error) return access.error;
    const template = getTemplateByType("GENERAL_SERVICE_AGREEMENT");
    const terms = renderTemplate(template.body, {
      production_name: access.project?.title ?? "Project",
      production_company: access.project?.pitches?.[0]?.productionCompany ?? "Story Time Production",
      party_name: source.name,
      party_type: fundingTypeLabel(source.type),
      role: `Funding agreement (${source.instrument})`,
      rate: `Committed: R${source.amountCommitted.toLocaleString()}`,
      payment_terms: source.paymentSchedule ?? "As per funding milestones",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "TBD",
      custom_clauses: source.conditions ?? "As agreed between parties.",
      legal_disclaimer:
        structured.legalDisclaimer ??
        "Funding terms are customizable and should be reviewed by qualified legal and financial advisors.",
      location_name: "N/A",
      equipment_list: "N/A",
      project_involvement: "Financial support linked to project execution milestones.",
    });
    const contract = await prisma.projectContract.create({
      data: {
        projectId,
        type: "GENERAL_SERVICE_AGREEMENT",
        status: "DRAFT",
        subject: `Funding agreement · ${source.name}`,
        vendorName: source.name,
        createdById: access.userId ?? null,
      },
    });
    const version = await prisma.projectContractVersion.create({
      data: {
        contractId: contract.id,
        version: 1,
        terms,
        changeNotes: "Auto-generated from Funding Hub source.",
        createdById: access.userId ?? null,
      },
    });
    await prisma.projectContract.update({
      where: { id: contract.id },
      data: { currentVersionId: version.id },
    });
    structured = {
      ...structured,
      sources: structured.sources.map((s) =>
        s.id === source.id ? { ...s, linkedContractId: contract.id } : s,
      ),
    };
  }

  const secured =
    Math.max(
      num(body?.amount, existing.amount ?? 0),
      structured.sources.reduce((sum, s) => sum + num(s.amountCommitted), 0),
    ) || 0;
  const budget = await prisma.projectBudget.findUnique({ where: { projectId }, include: { lines: true } });
  const budgetTotal =
    budget?.totalPlanned ??
    budget?.lines.reduce((sum, line) => sum + num(line.total), 0) ??
    0;
  const stage = summarizeFundingStage(
    secured,
    budgetTotal,
    structured.applications.filter((a) => ["SUBMITTED", "UNDER_REVIEW", "CHANGES_REQUESTED"].includes(a.status)).length,
    false,
  );
  structured = { ...structured, fundingStatus: stage };

  const funding = await prisma.fundingRequest.update({
    where: { projectId },
    data: {
      ...(body?.option !== undefined ? { option: body.option } : {}),
      ...(body?.amount !== undefined ? { amount: body.amount } : {}),
      ...(body?.currency !== undefined ? { currency: body.currency } : {}),
      status: stage,
      details: composeFundingDetails(plainDetails ?? null, structured),
    },
  });

  return NextResponse.json({ funding });
}
