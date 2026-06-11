/** Film and Publication Board distributor licence (Story Time platform). */
export const FPB_DISTRIBUTOR_LICENSE = "FPB8/435149";

export const FPB_LOGO_PATH = "/fpb-logo.png";

const AGE_RATING_DEFAULT_MIN: Record<string, number> = {
  G: 0,
  PG: 7,
  "PG-13": 13,
  "16": 16,
  "18": 18,
  R: 18,
};

export function defaultMinAgeForRating(ageRating: string | null | undefined): number {
  if (!ageRating?.trim()) return 0;
  return AGE_RATING_DEFAULT_MIN[ageRating.trim()] ?? 0;
}

export function formatPlaybackAgeLabel(
  ageRating: string | null | undefined,
  minAge: number,
): string {
  const rating = ageRating?.trim();
  if (rating && minAge > 0) return `${rating} · ${minAge}+`;
  if (rating) return rating;
  if (minAge > 0) return `${minAge}+`;
  return "All ages";
}

export function formatAdvisoryShort(advisory: Record<string, unknown> | null | undefined): string | null {
  if (!advisory || typeof advisory !== "object") return null;
  const labels: Record<string, string> = {
    violence: "V",
    language: "L",
    sex: "S",
    nudity: "N",
    drugs: "D",
    horror: "H",
    selfHarm: "SH",
    discrimination: "DIS",
  };
  const codes = Object.entries(advisory)
    .filter(([key, val]) => val === true && key in labels)
    .map(([key]) => labels[key]);
  return codes.length > 0 ? codes.join(" ") : null;
}
