/**
 * Browse horizontal-row poster cards — fixed dimensions so large / odd artwork
 * (e.g. award-heavy posters) can never stretch a flex item on mobile Safari.
 */
export const browsePosterCardClass = "browse-poster-card";

export const browsePosterMediaClass =
  "browse-poster-media rounded-xl border border-white/8 bg-card shadow-media sm:rounded-2xl";

export const browsePosterCardImageSizes =
  "(max-width: 480px) 26vw, (max-width: 768px) 128px, (max-width: 1024px) 160px, 192px";

export const browsePosterCardSkeletonClass =
  "browse-poster-card browse-poster-media animate-pulse bg-white/[0.06] rounded-xl sm:rounded-2xl";

export const browseRowGapClass = "browse-poster-row items-start gap-3 sm:gap-4 md:gap-5";

/** Square album / music cards in browse rows. */
export const browseMusicCardClass =
  "box-border w-[6rem] min-w-[6rem] max-w-[6rem] shrink-0 grow-0 basis-[6rem] overflow-hidden sm:w-32 sm:min-w-32 sm:max-w-32 sm:basis-32 md:w-40 md:min-w-40 md:max-w-40 md:basis-40 lg:w-44 lg:min-w-44 lg:max-w-44 lg:basis-44";

export const browseMusicCardImageSizes =
  "(max-width: 480px) 96px, (max-width: 768px) 128px, (max-width: 1024px) 160px, 176px";
