export const LONG_FORM_TYPES = ["SERIES", "SHOW", "PODCAST"] as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  SERIES: "Series",
  SHOW: "Show",
  PODCAST: "Podcast",
  DOCUMENTARY: "Documentary",
  SHORT_FILM: "Short Film",
};

export function isLongFormType(type: string): boolean {
  return (LONG_FORM_TYPES as readonly string[]).includes(type);
}

export function contentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type] ?? type;
}
