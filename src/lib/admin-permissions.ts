import type { DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";

/** Granular admin capability suites — stored on User.adminRights JSON. */
export const ADMIN_RIGHT_KEYS = [
  "canManageUsers",
  "canManageContent",
  "canManageOriginals",
  "canManageMarketplace",
  "canManageRevenue",
  "canManageFinance",
  "canManageCompetition",
  "canViewActivity",
  "canManageSystem",
] as const;

export type AdminRightKey = (typeof ADMIN_RIGHT_KEYS)[number];
export type AdminRightsMap = Partial<Record<AdminRightKey, boolean>>;

export const ADMIN_RIGHT_SUITES: { key: AdminRightKey; label: string; description: string }[] = [
  { key: "canManageUsers", label: "Users & roles", description: "User directory, role changes, access requests" },
  { key: "canManageContent", label: "Content & catalogue", description: "Catalogue, encode health, credits, music" },
  { key: "canManageOriginals", label: "Story Time Originals", description: "Originals submissions, greenlit projects" },
  { key: "canManageMarketplace", label: "Marketplace", description: "Crew, cast, locations, vendors" },
  { key: "canManageRevenue", label: "Revenue analytics", description: "Revenue dashboards and reports" },
  { key: "canManageFinance", label: "Finance operations", description: "Payments, promo codes, funders, payout KYC" },
  { key: "canManageCompetition", label: "Competition", description: "Competition programs and judging" },
  { key: "canViewActivity", label: "Activity intelligence", description: "Platform activity log and telemetry" },
  { key: "canManageSystem", label: "System & AI", description: "AI/VA settings and platform tools" },
];

/** Primary platform owner — permanent full access; cannot be revoked or modified. */
const GOD_EMAILS = new Set(
  [
    process.env.ADMIN_GOD_EMAIL?.trim().toLowerCase(),
    "acenomvete@icloud.com",
  ].filter((e): e is string => Boolean(e)),
);

export function isAdminGodAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  return GOD_EMAILS.has(email.trim().toLowerCase());
}

export function parseAdminRights(raw: unknown): AdminRightsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: AdminRightsMap = {};
  for (const key of ADMIN_RIGHT_KEYS) {
    if ((raw as Record<string, unknown>)[key] === true) out[key] = true;
  }
  return out;
}

/** Null/undefined adminRights = legacy unrestricted admin (pre–suite enforcement). */
export function hasLegacyFullAdminAccess(rights: unknown): boolean {
  return rights == null;
}

export function allAdminRights(): AdminRightsMap {
  return Object.fromEntries(ADMIN_RIGHT_KEYS.map((k) => [k, true])) as AdminRightsMap;
}

export function hasAnyAdminRight(
  rights: unknown,
  opts?: { email?: string | null; isAdminRole?: boolean },
): boolean {
  if (opts?.email && isAdminGodAccount(opts.email)) return true;
  if (!opts?.isAdminRole) return false;
  if (hasLegacyFullAdminAccess(rights)) return true;
  const parsed = parseAdminRights(rights);
  return ADMIN_RIGHT_KEYS.some((key) => parsed[key] === true);
}

export function hasAdminRight(
  rights: unknown,
  key: AdminRightKey,
  opts?: { email?: string | null; isAdminRole?: boolean },
): boolean {
  if (opts?.email && isAdminGodAccount(opts.email)) return true;
  if (!opts?.isAdminRole) return false;
  if (hasLegacyFullAdminAccess(rights)) return true;
  const parsed = parseAdminRights(rights);
  return parsed[key] === true;
}

/** Longest-prefix wins. `null` = any admin may access (overview). */
const ADMIN_PATH_RULES: { prefix: string; right: AdminRightKey | null }[] = [
  { prefix: "/admin/users", right: "canManageUsers" },
  { prefix: "/admin/creators", right: "canManageUsers" },
  { prefix: "/admin/requests", right: "canManageUsers" },
  { prefix: "/admin/activity", right: "canViewActivity" },
  { prefix: "/admin/content", right: "canManageContent" },
  { prefix: "/admin/encode-health", right: "canManageContent" },
  { prefix: "/admin/credit-people", right: "canManageContent" },
  { prefix: "/admin/music", right: "canManageContent" },
  { prefix: "/admin/review", right: "canManageContent" },
  { prefix: "/admin/script-reviews", right: "canManageContent" },
  { prefix: "/admin/projects", right: "canManageContent" },
  { prefix: "/admin/originals", right: "canManageOriginals" },
  { prefix: "/admin/crew", right: "canManageMarketplace" },
  { prefix: "/admin/cast", right: "canManageMarketplace" },
  { prefix: "/admin/locations", right: "canManageMarketplace" },
  { prefix: "/admin/marketplace-vendors", right: "canManageMarketplace" },
  { prefix: "/admin/revenue", right: "canManageRevenue" },
  { prefix: "/admin/payments", right: "canManageFinance" },
  { prefix: "/admin/promo-codes", right: "canManageFinance" },
  { prefix: "/admin/funders", right: "canManageFinance" },
  { prefix: "/admin/funding-programs", right: "canManageFinance" },
  { prefix: "/admin/payout-verification", right: "canManageFinance" },
  { prefix: "/admin/competition", right: "canManageCompetition" },
  { prefix: "/admin/ai", right: "canManageSystem" },
  { prefix: "/api/admin/users", right: "canManageUsers" },
  { prefix: "/api/admin/creators", right: "canManageUsers" },
  { prefix: "/api/admin/requests", right: "canManageUsers" },
  { prefix: "/api/admin/access-applications", right: "canManageUsers" },
  { prefix: "/api/admin/team", right: "canManageUsers" },
  { prefix: "/api/admin/activity", right: "canViewActivity" },
  { prefix: "/api/admin/content", right: "canManageContent" },
  { prefix: "/api/admin/encode-health", right: "canManageContent" },
  { prefix: "/api/admin/credit-people", right: "canManageContent" },
  { prefix: "/api/admin/music", right: "canManageContent" },
  { prefix: "/api/admin/script-reviews", right: "canManageContent" },
  { prefix: "/api/admin/projects", right: "canManageContent" },
  { prefix: "/api/admin/originals", right: "canManageOriginals" },
  { prefix: "/api/admin/crew", right: "canManageMarketplace" },
  { prefix: "/api/admin/cast", right: "canManageMarketplace" },
  { prefix: "/api/admin/locations", right: "canManageMarketplace" },
  { prefix: "/api/admin/marketplace-vendors", right: "canManageMarketplace" },
  { prefix: "/api/admin/revenue", right: "canManageRevenue" },
  { prefix: "/api/admin/payments", right: "canManageFinance" },
  { prefix: "/api/admin/promo-codes", right: "canManageFinance" },
  { prefix: "/api/admin/funders", right: "canManageFinance" },
  { prefix: "/api/admin/funding-programs", right: "canManageFinance" },
  { prefix: "/api/admin/payout", right: "canManageFinance" },
  { prefix: "/api/admin/competition", right: "canManageCompetition" },
  { prefix: "/api/admin/ai", right: "canManageSystem" },
  { prefix: "/api/admin/stats", right: null },
  { prefix: "/api/admin/analytics", right: null },
  { prefix: "/admin", right: null },
];

export function requiredAdminRightForPath(path: string): AdminRightKey | null {
  const normalized = path.split("?")[0] ?? path;
  let match: AdminRightKey | null | undefined;
  let bestLen = -1;
  for (const rule of ADMIN_PATH_RULES) {
    if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) {
      if (rule.prefix.length > bestLen) {
        bestLen = rule.prefix.length;
        match = rule.right;
      }
    }
  }
  if (match === undefined) {
    if (normalized.startsWith("/api/admin/")) return null;
    return "canManageSystem";
  }
  return match;
}

export function canAccessAdminPath(
  path: string,
  rights: unknown,
  opts?: { email?: string | null; isAdminRole?: boolean },
): boolean {
  const required = requiredAdminRightForPath(path);
  if (required === null) return hasAnyAdminRight(rights, opts);
  return hasAdminRight(rights, required, opts);
}

const NAV_ITEM_RIGHTS: Record<string, AdminRightKey | null> = {
  "/admin": null,
  "/admin/review": "canManageContent",
  "/admin/script-reviews": "canManageContent",
  "/admin/projects": "canManageContent",
  "/admin/content": "canManageContent",
  "/admin/encode-health": "canManageContent",
  "/admin/credit-people": "canManageContent",
  "/admin/originals": "canManageOriginals",
  "/admin/music": "canManageContent",
  "/admin/crew": "canManageMarketplace",
  "/admin/cast": "canManageMarketplace",
  "/admin/locations": "canManageMarketplace",
  "/admin/marketplace-vendors": "canManageMarketplace",
  "/admin/revenue": "canManageRevenue",
  "/admin/payments": "canManageFinance",
  "/admin/promo-codes": "canManageFinance",
  "/admin/funders": "canManageFinance",
  "/admin/funding-programs": "canManageFinance",
  "/admin/payout-verification": "canManageFinance",
  "/admin/users": "canManageUsers",
  "/admin/creators": "canManageUsers",
  "/admin/requests": "canManageUsers",
  "/admin/activity": "canViewActivity",
  "/admin/ai": "canManageSystem",
  "/admin/competition": "canManageCompetition",
  "/browse": null,
};

export function filterAdminNavSections(
  sections: DashboardNavSection[],
  rights: unknown,
  email?: string | null,
): DashboardNavSection[] {
  const opts = { email, isAdminRole: true as const };
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const required = NAV_ITEM_RIGHTS[item.href];
        if (required === undefined) return hasAdminRight(rights, "canManageSystem", opts);
        if (required === null) {
          return item.href === "/browse" || hasAnyAdminRight(rights, opts);
        }
        return hasAdminRight(rights, required, opts);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function adminRightsSummary(rights: unknown, email?: string | null): string {
  if (email && isAdminGodAccount(email)) return "Platform owner (permanent full access)";
  if (hasLegacyFullAdminAccess(rights)) return "Full admin access";
  const parsed = parseAdminRights(rights);
  const active = ADMIN_RIGHT_SUITES.filter((s) => parsed[s.key]).map((s) => s.label);
  if (active.length === 0) return "No sections assigned";
  if (active.length === ADMIN_RIGHT_SUITES.length) return "All sections";
  return active.join(", ");
}

export function sanitizeAssignedAdminRights(raw: unknown): AdminRightsMap {
  return parseAdminRights(raw);
}

/** Block any mutation targeting the platform owner account. */
export function assertAdminTargetMutable(email: string | null | undefined): void {
  if (isAdminGodAccount(email)) {
    throw Object.assign(new Error("The platform owner account is permanent and cannot be modified."), { status: 403 });
  }
}
