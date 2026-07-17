/** Catalogue content formats (stored on Content.type as strings). */

export const LONG_FORM_TYPES = [
  "SERIES",
  "SHOW",
  "PODCAST",
  "WEB_SERIES",
  "REALITY",
  "NEWS",
] as const;

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  MOVIE: "Movie",
  DOCUMENTARY: "Documentary",
  SHORT_FILM: "Short Film",
  SERIES: "Series",
  SHOW: "Show",
  PODCAST: "Podcast",
  COMEDY_SKIT: "Comedy Skit",
  STAND_UP: "Stand-Up",
  ANIMATION: "Animation",
  SPORTS: "Sports",
  MUSIC_VIDEO: "Music Video",
  LIVE_EVENT: "Live Event",
  REALITY: "Reality",
  NEWS: "News",
  EDUCATIONAL: "Educational",
  WEB_SERIES: "Web Series",
};

/** Always visible on the creator upload type step. */
export const PRIMARY_UPLOAD_TYPE_VALUES = [
  "MOVIE",
  "SERIES",
  "SHOW",
  "DOCUMENTARY",
  "SHORT_FILM",
  "PODCAST",
] as const;

/** Revealed via “View more formats” on creator upload. */
export const MORE_UPLOAD_TYPE_VALUES = [
  "COMEDY_SKIT",
  "STAND_UP",
  "ANIMATION",
  "SPORTS",
  "MUSIC_VIDEO",
  "LIVE_EVENT",
  "REALITY",
  "WEB_SERIES",
  "NEWS",
  "EDUCATIONAL",
] as const;

export const ALL_CATALOGUE_TYPE_VALUES = [
  ...PRIMARY_UPLOAD_TYPE_VALUES,
  ...MORE_UPLOAD_TYPE_VALUES,
] as const;

export type CatalogueContentType = (typeof ALL_CATALOGUE_TYPE_VALUES)[number];

export const UPLOAD_TYPE_DESCRIPTIONS: Record<string, string> = {
  MOVIE: "Feature film or theatrical-length title",
  SERIES: "Multi-episode scripted series",
  SHOW: "Variety, talk, or entertainment show",
  DOCUMENTARY: "Feature or episodic documentary",
  SHORT_FILM: "Short-form narrative or experimental",
  PODCAST: "Audio or video podcast series",
  COMEDY_SKIT: "Sketch comedy and short comedy bits",
  STAND_UP: "Stand-up specials and comedy sets",
  ANIMATION: "Animated films, series, or shorts",
  SPORTS: "Matches, highlights, and sports coverage",
  MUSIC_VIDEO: "Music videos and visual singles",
  LIVE_EVENT: "Concerts, festivals, and live captures",
  REALITY: "Reality and unscripted formats",
  WEB_SERIES: "Episode-based web / digital series",
  NEWS: "News, current affairs, and reports",
  EDUCATIONAL: "Learning, tutorials, and explainers",
};

/** Desktop viewer top-nav category links (Music Library removed). */
export const VIEWER_NAV_CATEGORIES = [
  { label: "Movies", value: "MOVIE", href: "/browse?type=MOVIE" },
  { label: "Series", value: "SERIES", href: "/browse?type=SERIES" },
  { label: "Shows", value: "SHOW", href: "/browse?type=SHOW" },
  { label: "Animation", value: "ANIMATION", href: "/browse?type=ANIMATION" },
  { label: "Sports", value: "SPORTS", href: "/browse?type=SPORTS" },
  { label: "Comedy", value: "COMEDY_SKIT", href: "/browse?type=COMEDY_SKIT" },
  { label: "Documentaries", value: "DOCUMENTARY", href: "/browse?type=DOCUMENTARY" },
  { label: "Podcasts", value: "PODCAST", href: "/browse?type=PODCAST" },
] as const;

/** Overflow viewer categories under a “More” menu. */
export const VIEWER_NAV_MORE_CATEGORIES = [
  { label: "Short Films", value: "SHORT_FILM", href: "/browse?type=SHORT_FILM" },
  { label: "Stand-Up", value: "STAND_UP", href: "/browse?type=STAND_UP" },
  { label: "Live Events", value: "LIVE_EVENT", href: "/browse?type=LIVE_EVENT" },
  { label: "Music Videos", value: "MUSIC_VIDEO", href: "/browse?type=MUSIC_VIDEO" },
  { label: "Reality", value: "REALITY", href: "/browse?type=REALITY" },
  { label: "Web Series", value: "WEB_SERIES", href: "/browse?type=WEB_SERIES" },
  { label: "News", value: "NEWS", href: "/browse?type=NEWS" },
  { label: "Educational", value: "EDUCATIONAL", href: "/browse?type=EDUCATIONAL" },
  { label: "Student Films", value: "AFDA", href: "/browse?filter=afda" },
] as const;

export function isLongFormType(type: string): boolean {
  return (LONG_FORM_TYPES as readonly string[]).includes(type);
}

export function isCatalogueContentType(type: string): boolean {
  return (ALL_CATALOGUE_TYPE_VALUES as readonly string[]).includes(type);
}

export function contentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type] ?? type;
}

export function contentTypePluralLabel(type: string): string {
  const labels: Record<string, string> = {
    MOVIE: "Movies",
    SERIES: "Series",
    SHOW: "Shows",
    DOCUMENTARY: "Documentaries",
    SHORT_FILM: "Short Films",
    PODCAST: "Podcasts",
    COMEDY_SKIT: "Comedy Skits",
    STAND_UP: "Stand-Up",
    ANIMATION: "Animation",
    SPORTS: "Sports",
    MUSIC_VIDEO: "Music Videos",
    LIVE_EVENT: "Live Events",
    REALITY: "Reality",
    WEB_SERIES: "Web Series",
    NEWS: "News",
    EDUCATIONAL: "Educational",
  };
  return labels[type] ?? contentTypeLabel(type);
}
