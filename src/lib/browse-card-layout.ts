/**
 * Browse horizontal-row poster cards.
 * Fixed flex-basis + width (not vw) on mobile — iOS Safari flex rows ignore max-width
 * when a large poster sets min-content size unless basis is explicit in rem.
 */
export const browsePosterCardClass =
  "flex-[0_0_5.75rem] w-[5.75rem] max-w-[5.75rem] min-w-0 shrink-0 snap-start overflow-hidden sm:flex-[0_0_8rem] sm:w-32 sm:max-w-32 md:flex-[0_0_10rem] md:w-40 md:max-w-40 lg:flex-[0_0_12rem] lg:w-48 lg:max-w-48";

/** 2:3 media frame — height follows the locked card width. */
export const browsePosterMediaClass =
  "relative aspect-[2/3] w-full min-h-0 overflow-hidden rounded-xl border border-white/8 bg-card shadow-media sm:rounded-2xl";

export const browsePosterCardImageSizes =
  "(max-width: 480px) 92px, (max-width: 768px) 128px, (max-width: 1024px) 160px, 192px";

export const browsePosterCardSkeletonClass =
  "flex-[0_0_5.75rem] aspect-[2/3] w-[5.75rem] max-w-[5.75rem] min-w-0 shrink-0 snap-start rounded-xl sm:flex-[0_0_8rem] sm:w-32 sm:max-w-32 sm:rounded-2xl md:flex-[0_0_10rem] md:w-40 md:max-w-40 lg:flex-[0_0_12rem] lg:w-48 lg:max-w-48";

export const browseRowGapClass = "items-start gap-3 sm:gap-4 md:gap-5";

/** Square album / music cards in browse rows. */
export const browseMusicCardClass =
  "flex-none shrink-0 w-[26vw] max-w-[6.5rem] overflow-hidden sm:w-32 md:w-40 lg:w-44";

export const browseMusicCardImageSizes =
  "(max-width: 480px) 26vw, (max-width: 768px) 128px, (max-width: 1024px) 160px, 176px";
