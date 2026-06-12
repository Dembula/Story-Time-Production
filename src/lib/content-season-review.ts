import { LONG_FORM_TYPES } from "./content-types";

export type SeasonSummary = {
  seasonNumber: number;
  title: string | null;
  published: boolean;
};

/** Series is live but a newly submitted season awaits admin approval. */
export function hasPendingSeasonReview(
  type: string,
  reviewStatus: string,
  published: boolean,
  seasons: SeasonSummary[],
): boolean {
  if (!(LONG_FORM_TYPES as readonly string[]).includes(type)) return false;
  if (reviewStatus !== "PENDING" || !published) return false;
  const hasLive = seasons.some((s) => s.published);
  const hasPending = seasons.some((s) => !s.published);
  return hasLive && hasPending;
}

export function pendingSeasonLabels(seasons: SeasonSummary[]): string[] {
  return seasons
    .filter((s) => !s.published)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((s) => s.title ?? `Season ${s.seasonNumber}`);
}

/** Live catalogue title with one or more unpublished seasons (new season submission). */
export function isSeasonOnlyCatalogueUpdate(
  published: boolean,
  seasons: SeasonSummary[],
): boolean {
  if (!published) return false;
  const hasLive = seasons.some((s) => s.published);
  const hasPending = seasons.some((s) => !s.published);
  return hasLive && hasPending;
}
