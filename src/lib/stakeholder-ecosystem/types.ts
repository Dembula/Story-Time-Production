export type StakeholderPortalKey =
  | "casting-agency"
  | "crew-team"
  | "location-owner"
  | "equipment-company"
  | "catering-company"
  | "funders"
  | "music-creator";

export type StakeholderTaskItem = {
  id: string;
  title: string;
  subtitle?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  href: string;
  kind: string;
  dueAt?: string | null;
};

export type StakeholderCalendarItem = {
  id: string;
  title: string;
  date: string;
  endDate?: string | null;
  kind: string;
  href?: string;
};

export type StakeholderActivityItem = {
  id: string;
  title: string;
  body?: string;
  at: string;
  kind: string;
  href?: string;
};

export type StakeholderApprovalItem = {
  id: string;
  title: string;
  amount?: number | null;
  status: string;
  href: string;
};

export type StakeholderWorkspaceOverview = {
  role: string;
  portal: StakeholderPortalKey;
  generatedAt: string;
  greeting: string;
  summary: string;
  tasks: StakeholderTaskItem[];
  calendar: StakeholderCalendarItem[];
  activity: StakeholderActivityItem[];
  approvals: StakeholderApprovalItem[];
  alerts: string[];
  unreadNotifications: number;
  quickActions: { href: string; label: string; description?: string }[];
  connectedProductions: number;
  /** Role-specific deep module summaries (inventory, forecasts, analytics). */
  moduleInsights?: Record<string, unknown>;
  /** Location owner vs on-site manager context. */
  locationContext?: { mode: "owner" | "manager"; listingCount: number };
};
