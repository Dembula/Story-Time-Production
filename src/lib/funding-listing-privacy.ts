export type PublicFundingListingMeta = {
  teaserTitle?: string | null;
  teaserLogline?: string | null;
  teaserGenre?: string | null;
  teaserFormat?: string | null;
  budgetBand?: string | null;
  stage?: string | null;
  territory?: string | null;
  useOfFundsSummary?: string | null;
  revenueModelSummary?: string | null;
  teamCredibility?: string | null;
  /** Fields intentionally hidden until a funder expresses interest */
  lockedUntilInterest?: boolean;
};

export function buildPublicOpportunityView(
  opportunity: {
    id: string;
    title: string;
    description: string | null;
    fundingTarget: number;
    marketCategory: string;
    type: string;
    equityOfferedPct: number | null;
    revenueModel: string | null;
    termsSummary: string | null;
    publicListingMeta: unknown;
    project?: { title?: string | null; logline?: string | null; genre?: string | null; budget?: number | null } | null;
  },
  options?: { revealFull?: boolean },
) {
  const meta = (opportunity.publicListingMeta ?? {}) as PublicFundingListingMeta;
  const locked = meta.lockedUntilInterest !== false && !options?.revealFull;

  if (locked) {
    return {
      id: opportunity.id,
      title: meta.teaserTitle || opportunity.title,
      logline: meta.teaserLogline || null,
      genre: meta.teaserGenre || null,
      format: meta.teaserFormat || opportunity.marketCategory.replaceAll("_", " "),
      budgetBand: meta.budgetBand || (opportunity.fundingTarget > 0 ? `Seeking ~R${Math.round(opportunity.fundingTarget).toLocaleString()}` : null),
      stage: meta.stage || "Pre-production",
      territory: meta.territory || null,
      useOfFunds: meta.useOfFundsSummary || null,
      revenueModel: meta.revenueModelSummary || opportunity.revenueModel,
      teamCredibility: meta.teamCredibility || null,
      equityOfferedPct: opportunity.equityOfferedPct,
      termsSummary: opportunity.termsSummary,
      fundingTarget: opportunity.fundingTarget,
      marketCategory: opportunity.marketCategory,
      privacyLocked: true,
      projectTitle: null,
      projectLogline: null,
      fullDescription: null,
    };
  }

  return {
    id: opportunity.id,
    title: opportunity.title,
    logline: opportunity.project?.logline ?? meta.teaserLogline ?? null,
    genre: opportunity.project?.genre ?? meta.teaserGenre ?? null,
    format: meta.teaserFormat || opportunity.type,
    budgetBand: meta.budgetBand || null,
    stage: meta.stage || null,
    territory: meta.territory || null,
    useOfFunds: meta.useOfFundsSummary || null,
    revenueModel: opportunity.revenueModel,
    teamCredibility: meta.teamCredibility || null,
    equityOfferedPct: opportunity.equityOfferedPct,
    termsSummary: opportunity.termsSummary,
    fundingTarget: opportunity.fundingTarget,
    marketCategory: opportunity.marketCategory,
    privacyLocked: false,
    projectTitle: opportunity.project?.title ?? null,
    projectLogline: opportunity.project?.logline ?? null,
    fullDescription: opportunity.description,
  };
}
