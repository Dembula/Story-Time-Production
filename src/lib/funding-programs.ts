import type { FundingSourceType } from "@/lib/funding-hub-db";

export type FundingProgramRow = {
  id: string;
  title: string;
  description: string | null;
  programType: string;
  funderType: string;
  managedBy: string;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
  categories: string | null;
  requirements: string | null;
  applicationDeadline: Date | null;
  contactEmail: string | null;
  region: string | null;
  status: string;
  visible: boolean;
  funderProfile?: {
    legalName: string | null;
    user?: { name: string | null; professionalName: string | null } | null;
  } | null;
};

export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function shapeFundingProgramForMarketplace(row: FundingProgramRow) {
  const categories = parseJsonStringArray(row.categories);
  const requirements = parseJsonStringArray(row.requirements);
  const sponsor =
    row.funderProfile?.legalName ||
    row.funderProfile?.user?.professionalName ||
    row.funderProfile?.user?.name ||
    (row.managedBy === "ADMIN" ? "Story Time" : "Funding partner");

  return {
    id: row.id,
    name: row.title,
    type: row.funderType as FundingSourceType,
    description: row.description ?? "",
    categories,
    minAmount: row.minAmount ?? 0,
    maxAmount: row.maxAmount ?? 0,
    requirements,
    applicationDeadline: row.applicationDeadline?.toISOString().slice(0, 10) ?? null,
    contact: row.contactEmail ?? "",
    region: row.region,
    programType: row.programType,
    managedBy: row.managedBy,
    sponsorName: sponsor,
    status: row.status,
  };
}

export function programMatchScore(
  program: ReturnType<typeof shapeFundingProgramForMarketplace>,
  params: { genre: string | null; budget: number; secured: number },
): number {
  let score = 0;
  const needed = Math.max(0, params.budget - params.secured);
  if (program.maxAmount > 0) {
    if (needed >= program.minAmount && needed <= program.maxAmount) score += 50;
    else if (needed > 0 && needed <= program.maxAmount * 1.2) score += 30;
  }
  if (params.genre) {
    const g = params.genre.toUpperCase().replace(/\s+/g, "_");
    if (program.categories.some((c) => c.toUpperCase().includes(g))) score += 25;
  }
  if (!program.region || program.region.toLowerCase().includes("africa")) score += 10;
  if (program.type === "INTERNAL_STORYTIME") score += 8;
  return Math.min(100, score);
}
