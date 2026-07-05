import { prisma } from "@/lib/prisma";
import {
  composeFundingDetails,
  parseFundingDetails,
  type FundingApplicationRecord,
  type FundingHubStructured,
  type FundingInstrumentType,
  type FundingSourceRecord,
  type FundingSourceType,
} from "@/lib/funding-hub-db";

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function programTypeToInstrument(programType: string): FundingInstrumentType {
  const map: Record<string, FundingInstrumentType> = {
    GRANT: "GRANT",
    EQUITY: "EQUITY",
    LOAN: "LOAN",
    SPONSORSHIP: "SPONSORSHIP",
    INTERNAL: "SELF_FUNDED",
  };
  return map[programType.toUpperCase()] ?? "GRANT";
}

function applicationFromDbRow(app: {
  id: string;
  programId: string;
  requestedAmount: number | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  documentFlags: unknown;
  program: {
    title: string;
    funderType: string;
    programType: string;
    funderProfile: { legalName: string | null } | null;
  };
}): FundingApplicationRecord {
  return {
    id: app.id,
    opportunityId: app.programId,
    funderName: app.program.funderProfile?.legalName || app.program.title,
    funderType: app.program.funderType as FundingSourceType,
    requestedAmount: app.requestedAmount ?? 0,
    status: app.status as FundingApplicationRecord["status"],
    submittedAt: app.createdAt.toISOString(),
    documents: (app.documentFlags ?? {}) as FundingApplicationRecord["documents"],
    notes: app.notes,
  };
}

/** When a program application is approved, mirror it as a committed funding source in hub JSON. */
export async function syncApprovedProgramApplicationToFundingHub(applicationId: string): Promise<boolean> {
  const application = await prisma.fundingProgramApplication.findUnique({
    where: { id: applicationId },
    include: {
      program: { include: { funderProfile: { select: { legalName: true } } } },
    },
  });
  if (!application || application.status !== "APPROVED") return false;

  let funding = await prisma.fundingRequest.findUnique({ where: { projectId: application.projectId } });
  if (!funding) {
    funding = await prisma.fundingRequest.create({
      data: {
        projectId: application.projectId,
        option: "REQUEST_FUNDING",
        currency: "ZAR",
        status: "IN_APPLICATION",
        details: composeFundingDetails(null, {
          legalDisclaimer:
            "Funding terms are customizable and should be reviewed by qualified legal and financial advisors.",
          fundingStatus: "IN_APPLICATION",
          minimumStartThresholdPercent: 35,
          sources: [],
          applications: [],
          allocations: [],
        }),
      },
    });
  }

  const parsed = parseFundingDetails(funding.details);
  let structured: FundingHubStructured = parsed.structured;

  const existingSource = structured.sources.find((s) => s.applicationId === applicationId);
  const appRecord = applicationFromDbRow(application);
  const applications = [...structured.applications.filter((a) => a.id !== applicationId), appRecord];

  if (existingSource) {
    structured = {
      ...structured,
      applications: applications.map((a) =>
        a.id === applicationId ? { ...a, status: "APPROVED", linkedSourceId: existingSource.id } : a,
      ),
    };
  } else {
    const sourceId = uid("src");
    const newSource: FundingSourceRecord = {
      id: sourceId,
      name: appRecord.funderName,
      type: appRecord.funderType,
      instrument: programTypeToInstrument(application.program.programType),
      amountCommitted: appRecord.requestedAmount,
      amountReceived: 0,
      paymentSchedule: "Per program approval and milestone schedule",
      conditions: `Approved program application · ${application.program.title}`,
      linkedContractId: null,
      status: "COMMITTED",
      notes: `Auto-linked when application ${applicationId.slice(-8)} was approved.`,
      applicationId,
      milestones: [],
    };
    structured = {
      ...structured,
      sources: [newSource, ...structured.sources],
      applications: applications.map((a) =>
        a.id === applicationId ? { ...a, status: "APPROVED", linkedSourceId: sourceId } : a,
      ),
      fundingStatus: structured.fundingStatus === "NOT_FUNDED" ? "IN_APPLICATION" : structured.fundingStatus,
    };
  }

  await prisma.fundingRequest.update({
    where: { projectId: application.projectId },
    data: { details: composeFundingDetails(parsed.plain, structured) },
  });

  return true;
}
