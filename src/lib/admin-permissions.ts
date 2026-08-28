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

/** Primary platform owner — full access; only this account can revoke other admins' rights. */
const GOD_EMAILS = new Set(
  [
    process.env.ADMIN_GOD_EMAIL?.trim().toLowerCase(),
    "acenomvete@icloud.com",
    "admin@storytime.local",
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

export function allAdminRights(): AdminRightsMap {
  return Object.fromEntries(ADMIN_RIGHT_KEYS.map((k) => [k, true])) as AdminRightsMap;
}

export function hasAdminRight(
  rights: AdminRightsMap | null | undefined,
  key: AdminRightKey,
  opts?: { email?: string | null; isAdminRole?: boolean },
): boolean {
  if (opts?.email && isAdminGodAccount(opts.email)) return true;
  if (!opts?.isAdminRole) return false;
  if (!rights || Object.keys(rights).length === 0) return true;
  return rights[key] === true;
}

export function adminRightsSummary(rights: AdminRightsMap | null | undefined, email?: string | null): string {
  if (email && isAdminGodAccount(email)) return "Platform owner (full access)";
  const parsed = parseAdminRights(rights);
  const active = ADMIN_RIGHT_SUITES.filter((s) => parsed[s.key]).map((s) => s.label);
  if (active.length === 0) return "Full admin (legacy — no suite restrictions)";
  if (active.length === ADMIN_RIGHT_SUITES.length) return "All suites";
  return active.join(", ");
}
