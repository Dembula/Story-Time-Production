/**
 * Browse horizontal-row poster cards.
 * Width is locked on the card shell; height comes from aspect-[2/3] on the media frame.
 * Never put w-full on the card root (breaks flex rows / Continue Watching).
 */
export const browsePosterCardClass =
  "flex-none shrink-0 snap-start overflow-hidden w-[26vw] max-w-[5.75rem] xs:w-[26vw] sm:w-32 md:w-40 lg:w-48";

/** 2:3 media frame — height always follows the locked card width. */
export const browsePosterMediaClass =
  "relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/8 bg-card shadow-media sm:rounded-2xl";

export const browsePosterCardImageSizes =
  "(max-width: 480px) 26vw, (max-width: 768px) 128px, (max-width: 1024px) 160px, 192px";

export const browsePosterCardSkeletonClass =
  "flex-none shrink-0 aspect-[2/3] w-[26vw] max-w-[5.75rem] snap-start rounded-xl xs:w-[26vw] sm:w-32 sm:rounded-2xl md:w-40 lg:w-48";

export const browseRowGapClass = "items-start gap-3 sm:gap-4 md:gap-5";

/** Square album / music cards in browse rows. */
export const browseMusicCardClass =
  "flex-none shrink-0 w-[26vw] max-w-[6.5rem] overflow-hidden sm:w-32 md:w-40 lg:w-44";

export const browseMusicCardImageSizes =
  "(max-width: 480px) 26vw, (max-width: 768px) 128px, (max-width: 1024px) 160px, 176px";
