const FUNDING_META_START = "[ST_FUNDING_HUB_JSON]";
const FUNDING_META_END = "[/ST_FUNDING_HUB_JSON]";

export type FundingSourceType = "INSTITUTIONAL" | "PRIVATE" | "INTERNAL_STORYTIME";
export type FundingInstrumentType = "GRANT" | "EQUITY" | "LOAN" | "SPONSORSHIP" | "SELF_FUNDED";
export type FundingApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";
export type FundingMilestonePhase = "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "DELIVERY";

export type FundingMilestone = {
  id: string;
  phase: FundingMilestonePhase;
  dueDate?: string | null;
  amount: number;
  paid: boolean;
  paidAt?: string | null;
  note?: string | null;
};

export type FundingSourceRecord = {
  id: string;
  name: string;
  type: FundingSourceType;
  instrument: FundingInstrumentType;
  amountCommitted: number;
  amountReceived: number;
  paymentSchedule?: string | null;
  conditions?: string | null;
  linkedContractId?: string | null;
  status: "COMMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "ON_HOLD";
  notes?: string | null;
  milestones: FundingMilestone[];
};

export type FundingApplicationRecord = {
  id: string;
  opportunityId: string;
  funderName: string;
  funderType: FundingSourceType;
  requestedAmount: number;
  status: FundingApplicationStatus;
  submittedAt: string;
  documents: {
    pitchDeck: boolean;
    script: boolean;
    budget: boolean;
    productionPlan: boolean;
    teamDetails: boolean;
  };
  notes?: string | null;
};

export type FundingAllocation = {
  id: string;
  department: string;
  amount: number;
  note?: string | null;
};

export type FundingHubStructured = {
  legalDisclaimer?: string | null;
  fundingStatus?:
    | "NOT_FUNDED"
    | "SEEKING_FUNDING"
    | "IN_APPLICATION"
    | "PARTIALLY_FUNDED"
    | "FULLY_FUNDED"
    | "IN_PRODUCTION";
  minimumStartThresholdPercent?: number | null;
  sources: FundingSourceRecord[];
  applications: FundingApplicationRecord[];
  allocations: FundingAllocation[];
};

export type FundingOpportunity = {
  id: string;
  name: string;
  type: FundingSourceType;
  description: string;
  categories: string[];
  minAmount: number;
  maxAmount: number;
  requirements: string[];
  applicationDeadline: string | null;
  contact: string;
  region: string | null;
  pastProjects?: string[];
};

const DEFAULT_STRUCTURED: FundingHubStructured = {
  legalDisclaimer:
    "Funding terms are customizable and should be reviewed by qualified legal and financial advisors.",
  fundingStatus: "NOT_FUNDED",
  minimumStartThresholdPercent: 35,
  sources: [],
  applications: [],
  allocations: [],
};

export function parseFundingDetails(text: string | null | undefined): {
  plain: string | null;
  structured: FundingHubStructured;
} {
  const raw = (text ?? "").trim();
  if (!raw) return { plain: null, structured: { ...DEFAULT_STRUCTURED } };
  const start = raw.indexOf(FUNDING_META_START);
  const end = raw.indexOf(FUNDING_META_END);
  if (start === -1 || end === -1 || end <= start) {
    return { plain: raw, structured: { ...DEFAULT_STRUCTURED } };
  }
  const payload = raw.slice(start + FUNDING_META_START.length, end).trim();
  const before = raw.slice(0, start).trim();
  const after = raw.slice(end + FUNDING_META_END.length).trim();
  const plain = [before, after].filter(Boolean).join("\n\n").trim() || null;
  try {
    const parsed = JSON.parse(payload) as Partial<FundingHubStructured>;
    return {
      plain,
      structured: {
        ...DEFAULT_STRUCTURED,
        ...parsed,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        applications: Array.isArray(parsed.applications) ? parsed.applications : [],
        allocations: Array.isArray(parsed.allocations) ? parsed.allocations : [],
      },
    };
  } catch {
    return { plain, structured: { ...DEFAULT_STRUCTURED } };
  }
}

export function composeFundingDetails(
  plainText: string | null | undefined,
  structured: FundingHubStructured,
): string {
  const plain = (plainText ?? "").trim();
  const normalized: FundingHubStructured = {
    ...DEFAULT_STRUCTURED,
    ...structured,
    sources: Array.isArray(structured.sources) ? structured.sources : [],
    applications: Array.isArray(structured.applications) ? structured.applications : [],
    allocations: Array.isArray(structured.allocations) ? structured.allocations : [],
  };
  const blocks = [plain, `${FUNDING_META_START}\n${JSON.stringify(normalized)}\n${FUNDING_META_END}`].filter(
    Boolean,
  );
  return blocks.join("\n\n");
}

export function fundingOpportunityCatalogue(): FundingOpportunity[] {
  return [
    {
      id: "storytime-internal-flex-fund",
      name: "Story Time Internal Flexible Fund",
      type: "INTERNAL_STORYTIME",
      description: "Platform-backed investment for eligible projects with milestone-based disbursement.",
      categories: ["SHORT_FILM", "FEATURE", "SERIES", "DOCUMENTARY"],
      minAmount: 25000,
      maxAmount: 1500000,
      requirements: ["Pitch deck", "Budget", "Script", "Production plan", "Team profile"],
      applicationDeadline: null,
      contact: "funding@storytime.africa",
      region: "Africa",
      pastProjects: ["Community Heat", "Dustline", "Night Transit"],
    },
    {
      id: "sa-film-commission-grant",
      name: "Regional Film Commission Grant",
      type: "INSTITUTIONAL",
      description: "Public film grant supporting culturally relevant scripted and documentary projects.",
      categories: ["SHORT_FILM", "FEATURE", "DOCUMENTARY"],
      minAmount: 100000,
      maxAmount: 4000000,
      requirements: ["Registered production entity", "Detailed budget", "Execution schedule"],
      applicationDeadline: "2026-08-31",
      contact: "applications@regionalfilmfund.org",
      region: "South Africa",
    },
    {
      id: "private-culture-capital",
      name: "Culture Capital Private Fund",
      type: "INSTITUTIONAL",
      description: "Private capital fund for high-potential projects with audience growth plans.",
      categories: ["FEATURE", "SERIES"],
      minAmount: 250000,
      maxAmount: 6000000,
      requirements: ["Pitch deck", "Distribution strategy", "Rights & recoupment terms"],
      applicationDeadline: "2026-06-20",
      contact: "partners@culturecapital.io",
      region: null,
    },
    {
      id: "brand-partner-sponsorship-pool",
      name: "Brand Partner Sponsorship Pool",
      type: "PRIVATE",
      description: "Sponsorship channel for brand-integrated productions.",
      categories: ["SHORT_FILM", "SERIES", "DOCUMENTARY"],
      minAmount: 50000,
      maxAmount: 850000,
      requirements: ["Brand fit proposal", "Audience profile", "Milestone reports"],
      applicationDeadline: null,
      contact: "sponsorships@storytime.africa",
      region: null,
    },
  ];
}

export function fundingTypeLabel(type: FundingSourceType): string {
  if (type === "INTERNAL_STORYTIME") return "Story Time Internal";
  if (type === "INSTITUTIONAL") return "Institutional";
  return "Private / External";
}
