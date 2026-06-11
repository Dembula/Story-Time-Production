import { safeCallbackPath } from "@/lib/auth-callback-path";

const CREATOR_PORTAL_PREFIXES = [
  "/creator",
  "/music-creator",
  "/equipment-company",
  "/location-owner",
  "/crew-team",
  "/casting-agency",
  "/catering-company",
  "/company",
  "/funders",
  "/wallet",
  "/payout-verification",
] as const;

export function isCreatorPortalPath(path: string | null | undefined): boolean {
  const safe = safeCallbackPath(path);
  if (!safe) return false;
  return CREATOR_PORTAL_PREFIXES.some((prefix) => safe === prefix || safe.startsWith(`${prefix}/`));
}

export function isAdminPortalPath(path: string | null | undefined): boolean {
  const safe = safeCallbackPath(path);
  if (!safe) return false;
  return safe === "/admin" || safe.startsWith("/admin/");
}

export function isViewerPortalPath(path: string | null | undefined): boolean {
  const safe = safeCallbackPath(path);
  if (!safe) return true;
  return !isCreatorPortalPath(safe) && !isAdminPortalPath(safe);
}

/** Sign-in page URL for a protected destination (includes callbackUrl when provided). */
export function signInUrlForDestination(destination: string): string {
  const safe = safeCallbackPath(destination) ?? "/";
  const query = `callbackUrl=${encodeURIComponent(safe)}`;

  if (isAdminPortalPath(safe)) {
    return `/auth/admin?${query}`;
  }
  if (isCreatorPortalPath(safe)) {
    return `/auth/creator/signin?${query}`;
  }
  return `/auth/signin?${query}`;
}

/**
 * When a generic sign-in page receives a callbackUrl for another portal, redirect there.
 * Returns null if the current page should render.
 */
export function resolvePortalSignInRedirect(
  currentSignInPath: "/auth/signin" | "/auth/creator/signin" | "/auth/admin",
  callbackUrl: string | null | undefined,
): string | null {
  const dest = safeCallbackPath(callbackUrl);
  if (!dest) return null;

  if (isAdminPortalPath(dest) && currentSignInPath !== "/auth/admin") {
    return signInUrlForDestination(dest);
  }
  if (isCreatorPortalPath(dest) && currentSignInPath !== "/auth/creator/signin") {
    return signInUrlForDestination(dest);
  }
  if (isViewerPortalPath(dest) && currentSignInPath !== "/auth/signin") {
    return signInUrlForDestination(dest);
  }
  return null;
}

export function defaultHomeForRole(role: string | null | undefined): string {
  const roleRedirects: Record<string, string> = {
    CONTENT_CREATOR: "/creator/command-center",
    MUSIC_CREATOR: "/music-creator/dashboard",
    EQUIPMENT_COMPANY: "/equipment-company/dashboard",
    LOCATION_OWNER: "/location-owner/dashboard",
    CREW_TEAM: "/crew-team/dashboard",
    CASTING_AGENCY: "/casting-agency/dashboard",
    CATERING_COMPANY: "/catering-company/dashboard",
    FUNDER: "/funders",
    ADMIN: "/admin",
    SUBSCRIBER: "/profiles",
  };
  return roleRedirects[role ?? ""] ?? "/profiles";
}

const ROLE_PATH_ACCESS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/creator", roles: ["CONTENT_CREATOR", "ADMIN"] },
  { prefix: "/music-creator", roles: ["MUSIC_CREATOR", "ADMIN"] },
  { prefix: "/equipment-company", roles: ["EQUIPMENT_COMPANY", "ADMIN"] },
  { prefix: "/location-owner", roles: ["LOCATION_OWNER", "ADMIN"] },
  { prefix: "/crew-team", roles: ["CREW_TEAM", "ADMIN"] },
  { prefix: "/casting-agency", roles: ["CASTING_AGENCY", "ADMIN"] },
  { prefix: "/catering-company", roles: ["CATERING_COMPANY", "ADMIN"] },
  { prefix: "/funders", roles: ["FUNDER", "ADMIN"] },
  { prefix: "/company", roles: ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY", "ADMIN"] },
  { prefix: "/wallet", roles: ["CONTENT_CREATOR", "MUSIC_CREATOR", "FUNDER", "ADMIN"] },
  { prefix: "/payout-verification", roles: ["CONTENT_CREATOR", "MUSIC_CREATOR", "EQUIPMENT_COMPANY", "LOCATION_OWNER", "CREW_TEAM", "CASTING_AGENCY", "CATERING_COMPANY", "FUNDER", "ADMIN"] },
];

export function roleCanAccessPath(role: string | null | undefined, path: string | null | undefined): boolean {
  const safe = safeCallbackPath(path);
  if (!safe) return true;
  if (role === "ADMIN") return true;
  for (const rule of ROLE_PATH_ACCESS) {
    if (safe === rule.prefix || safe.startsWith(`${rule.prefix}/`)) {
      return rule.roles.includes(role ?? "");
    }
  }
  return true;
}

export function resolvePostSignInRedirect(
  role: string | null | undefined,
  callbackPath: string | null,
): string {
  const home = defaultHomeForRole(role);
  if (!callbackPath || !roleCanAccessPath(role, callbackPath)) return home;
  return callbackPath;
}

export function defaultCreatorRoleForPath(path: string | null | undefined): string {
  const safe = safeCallbackPath(path);
  if (!safe) return "CONTENT_CREATOR";
  if (safe.startsWith("/music-creator")) return "MUSIC_CREATOR";
  if (safe.startsWith("/equipment-company")) return "EQUIPMENT_COMPANY";
  if (safe.startsWith("/location-owner")) return "LOCATION_OWNER";
  if (safe.startsWith("/crew-team")) return "CREW_TEAM";
  if (safe.startsWith("/casting-agency")) return "CASTING_AGENCY";
  if (safe.startsWith("/catering-company")) return "CATERING_COMPANY";
  if (safe.startsWith("/funders")) return "FUNDER";
  return "CONTENT_CREATOR";
}
