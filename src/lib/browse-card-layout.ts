/**
 * Locked poster widths for horizontal browse rows.
 * Use matching min/max/basis so intrinsic image size (unusual posters, award
 * composites, landscape fallbacks) can never stretch one card larger than others.
 */
export const browsePosterCardClass =
  "box-border w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] shrink-0 grow-0 basis-[5.5rem] snap-start overflow-hidden sm:w-32 sm:min-w-32 sm:max-w-32 sm:basis-32 md:w-40 md:min-w-40 md:max-w-40 md:basis-40 lg:w-48 lg:min-w-48 lg:max-w-48 lg:basis-48";

/** Shared 2:3 media frame — always full card width, never sized by the image. */
export const browsePosterMediaClass =
  "relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/8 bg-card shadow-media sm:rounded-2xl";

export const browsePosterCardImageSizes =
  "(max-width: 480px) 88px, (max-width: 768px) 128px, (max-width: 1024px) 160px, 192px";

export const browsePosterCardSkeletonClass =
  "aspect-[2/3] w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem] shrink-0 grow-0 basis-[5.5rem] rounded-xl sm:w-32 sm:min-w-32 sm:max-w-32 sm:basis-32 sm:rounded-2xl md:w-40 md:min-w-40 md:max-w-40 md:basis-40 lg:w-48 lg:min-w-48 lg:max-w-48 lg:basis-48";

/** Keep cards top-aligned so a taller title/meta line cannot stretch siblings. */
export const browseRowGapClass = "items-start gap-3 sm:gap-4 md:gap-5";

/** Square album / music cards in browse rows. */
export const browseMusicCardClass =
  "box-border w-[6rem] min-w-[6rem] max-w-[6rem] shrink-0 grow-0 basis-[6rem] overflow-hidden sm:w-32 sm:min-w-32 sm:max-w-32 sm:basis-32 md:w-40 md:min-w-40 md:max-w-40 md:basis-40 lg:w-44 lg:min-w-44 lg:max-w-44 lg:basis-44";

export const browseMusicCardImageSizes =
  "(max-width: 480px) 96px, (max-width: 768px) 128px, (max-width: 1024px) 160px, 176px";
