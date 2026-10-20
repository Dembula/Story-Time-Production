/** Shared creator-portal account types for signup + sign-in UI (edge-safe). */

export const CREATOR_SIGNIN_ROLE_OPTIONS = [
  { value: "CONTENT_CREATOR", label: "Content Creator" },
  { value: "MUSIC_CREATOR", label: "Music Creator" },
  { value: "EQUIPMENT_COMPANY", label: "Equipment Company" },
  { value: "LOCATION_OWNER", label: "Location Owner" },
  { value: "CREW_TEAM", label: "Crew Team" },
  { value: "CASTING_AGENCY", label: "Casting Agency" },
  { value: "CATERING_COMPANY", label: "Catering Company" },
  { value: "FUNDER", label: "Funder / Investor" },
  { value: "FESTIVAL_CURATOR", label: "Film Festival / Curator" },
] as const;

export type CreatorSignInRole = (typeof CREATOR_SIGNIN_ROLE_OPTIONS)[number]["value"];

export const CREATOR_SIGNUP_TYPE_TO_ROLE: Record<string, CreatorSignInRole> = {
  content: "CONTENT_CREATOR",
  music: "MUSIC_CREATOR",
  equipment: "EQUIPMENT_COMPANY",
  location: "LOCATION_OWNER",
  crew: "CREW_TEAM",
  casting: "CASTING_AGENCY",
  catering: "CATERING_COMPANY",
  funder: "FUNDER",
  festival: "FESTIVAL_CURATOR",
};

export function isCreatorSignInRole(role: string | null | undefined): role is CreatorSignInRole {
  if (!role) return false;
  return CREATOR_SIGNIN_ROLE_OPTIONS.some((o) => o.value === role);
}
