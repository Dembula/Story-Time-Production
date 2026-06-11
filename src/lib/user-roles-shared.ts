/** Edge-safe role constants and helpers (no Prisma). */

export const VIEWER_ROLES = new Set(["SUBSCRIBER"]);
export const CREATOR_ROLES = new Set([
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "EQUIPMENT_COMPANY",
  "LOCATION_OWNER",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "CATERING_COMPANY",
  "FUNDER",
]);
export const ADMIN_ROLES = new Set(["ADMIN"]);

export type PlatformRole =
  | "SUBSCRIBER"
  | "CONTENT_CREATOR"
  | "MUSIC_CREATOR"
  | "EQUIPMENT_COMPANY"
  | "LOCATION_OWNER"
  | "CREW_TEAM"
  | "CASTING_AGENCY"
  | "CATERING_COMPANY"
  | "FUNDER"
  | "ADMIN";

export const ALL_PLATFORM_ROLES: PlatformRole[] = [
  "SUBSCRIBER",
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "EQUIPMENT_COMPANY",
  "LOCATION_OWNER",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "CATERING_COMPANY",
  "FUNDER",
  "ADMIN",
];

export function userHasPlatformRole(
  roles: Iterable<string> | null | undefined,
  role: string,
): boolean {
  if (!roles) return false;
  const normalized = role.trim().toUpperCase();
  for (const entry of roles) {
    if (entry === normalized) return true;
  }
  return false;
}
