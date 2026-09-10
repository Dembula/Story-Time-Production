/** Optional self-described demographics for viewer profiles (aggregated for creators). */

export const VIEWER_GENDER_OPTIONS = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer not to say",
] as const;

export const VIEWER_RACE_OPTIONS = [
  "Black African",
  "Coloured",
  "Indian / Asian",
  "White",
  "Other",
  "Prefer not to say",
] as const;

export type ViewerGenderOption = (typeof VIEWER_GENDER_OPTIONS)[number];
export type ViewerRaceOption = (typeof VIEWER_RACE_OPTIONS)[number];

export function normalizeOptionalDemographic(
  value: unknown,
  allowed: readonly string[],
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return allowed.includes(trimmed) ? trimmed : null;
}
