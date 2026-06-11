/** Edge-safe platform role helpers (no Prisma). */

import { defaultHomeForRole } from "@/lib/auth-sign-in-path";
import {
  CREATOR_ROLES,
  VIEWER_ROLES,
  type PlatformRole,
} from "@/lib/user-roles-shared";

export type PortalScope = "VIEWER" | "CREATOR" | "ADMIN";

export type PlatformRoleOption = {
  role: PlatformRole;
  label: string;
  description: string;
  homePath: string;
  portalScope: PortalScope;
  group: "viewer" | "creator" | "admin";
};

const ROLE_META: Record<
  PlatformRole,
  Omit<PlatformRoleOption, "role" | "homePath" | "portalScope" | "group"> & {
    group: PlatformRoleOption["group"];
  }
> = {
  SUBSCRIBER: {
    label: "Viewer",
    description: "Watch films, series, and shows",
    group: "viewer",
  },
  CONTENT_CREATOR: {
    label: "Content Creator",
    description: "Projects, production tools, and catalogue",
    group: "creator",
  },
  MUSIC_CREATOR: {
    label: "Music Creator",
    description: "Music catalogue and sync licensing",
    group: "creator",
  },
  EQUIPMENT_COMPANY: {
    label: "Equipment Company",
    description: "Rentals and equipment marketplace",
    group: "creator",
  },
  LOCATION_OWNER: {
    label: "Location Owner",
    description: "Locations and bookings",
    group: "creator",
  },
  CREW_TEAM: {
    label: "Crew Team",
    description: "Crew services and bookings",
    group: "creator",
  },
  CASTING_AGENCY: {
    label: "Casting Agency",
    description: "Talent roster and casting requests",
    group: "creator",
  },
  CATERING_COMPANY: {
    label: "Catering Company",
    description: "On-set catering and bookings",
    group: "creator",
  },
  FUNDER: {
    label: "Funder / Investor",
    description: "Deals, verification, and portfolio",
    group: "creator",
  },
  ADMIN: {
    label: "Administrator",
    description: "Platform operations and review",
    group: "admin",
  },
};

const ROLE_SORT_ORDER: PlatformRole[] = [
  "SUBSCRIBER",
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "FUNDER",
  "CASTING_AGENCY",
  "CREW_TEAM",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
  "ADMIN",
];

export function getPortalScopeForRole(role: string | null | undefined): PortalScope {
  if (role === "ADMIN") return "ADMIN";
  if (role && VIEWER_ROLES.has(role)) return "VIEWER";
  if (role && CREATOR_ROLES.has(role)) return "CREATOR";
  return "VIEWER";
}

export function normalizePlatformRole(role: string | null | undefined): PlatformRole | null {
  if (!role) return null;
  const normalized = role.trim().toUpperCase();
  return normalized in ROLE_META ? (normalized as PlatformRole) : null;
}

export function sortPlatformRoles(roles: Iterable<string>): PlatformRole[] {
  const set = new Set<PlatformRole>();
  for (const role of roles) {
    const normalized = normalizePlatformRole(role);
    if (normalized) set.add(normalized);
  }
  return ROLE_SORT_ORDER.filter((role) => set.has(role));
}

export function buildPlatformRoleOption(role: PlatformRole): PlatformRoleOption {
  const meta = ROLE_META[role];
  return {
    role,
    label: meta.label,
    description: meta.description,
    group: meta.group,
    homePath: defaultHomeForRole(role),
    portalScope: getPortalScopeForRole(role),
  };
}

export function buildPlatformRoleOptions(roles: Iterable<string>): PlatformRoleOption[] {
  return sortPlatformRoles(roles).map(buildPlatformRoleOption);
}

export function requiredRoleForProtectedPath(pathname: string): PlatformRole | null {
  if (pathname.startsWith("/admin")) return "ADMIN";
  if (pathname.startsWith("/creator/join/")) return null;
  if (pathname.startsWith("/creator")) return "CONTENT_CREATOR";
  if (pathname.startsWith("/music-creator")) return "MUSIC_CREATOR";
  if (pathname.startsWith("/equipment-company")) return "EQUIPMENT_COMPANY";
  if (pathname.startsWith("/location-owner")) return "LOCATION_OWNER";
  if (pathname.startsWith("/crew-team")) return "CREW_TEAM";
  if (pathname.startsWith("/casting-agency")) return "CASTING_AGENCY";
  if (pathname.startsWith("/catering-company")) return "CATERING_COMPANY";
  if (pathname.startsWith("/funders")) return "FUNDER";
  return null;
}
