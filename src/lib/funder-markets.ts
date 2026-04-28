export const FUNDING_MARKET_CATEGORIES = [
  "FILM_PROJECT",
  "SCRIPT_RIGHTS",
  "COMPANY_EXPANSION",
  "GAP_FINANCING",
  "DISTRIBUTION_ADVANCE",
] as const;

export type FundingMarketCategory = (typeof FUNDING_MARKET_CATEGORIES)[number];

export const FUNDING_MARKET_LABELS: Record<FundingMarketCategory, string> = {
  FILM_PROJECT: "Film/Project Equity Funding",
  SCRIPT_RIGHTS: "Script Marketplace / Rights Acquisition",
  COMPANY_EXPANSION: "Company Expansion",
  GAP_FINANCING: "Gap / Bridge Financing",
  DISTRIBUTION_ADVANCE: "Distribution & Revenue-Share Advances",
};
