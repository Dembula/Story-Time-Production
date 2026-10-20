export const FESTIVAL_SUBMISSION_FEE_PURPOSE = "festival_submission_fee" as const;

export const FESTIVAL_STATUS = {
  DRAFT: "DRAFT",
  LIVE: "LIVE",
  SUBMISSIONS_CLOSED: "SUBMISSIONS_CLOSED",
  ENDED: "ENDED",
} as const;

export const FESTIVAL_MEMBER_ROLE = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  STAGE1_REVIEWER: "STAGE1_REVIEWER",
  STAGE2_REVIEWER: "STAGE2_REVIEWER",
} as const;

export const FESTIVAL_SELECTION = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  OFFICIAL_SELECTION: "OFFICIAL_SELECTION",
  NOT_SELECTED: "NOT_SELECTED",
} as const;

export const CONTENT_REVIEW_FESTIVAL_HOLD = "FESTIVAL_HOLD";

export type DeadlineTier = "earlybird" | "regular" | "late";

export function slugifyFestivalName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `festival-${Date.now().toString(36)}`;
}

/** Resolve which fee tier applies at `now` based on festival deadline timestamps. */
export function resolveDeadlineTier(festival: {
  earlybirdAt?: Date | string | null;
  regularAt?: Date | string | null;
  lateAt?: Date | string | null;
  openingAt?: Date | string | null;
}, now = new Date()): DeadlineTier {
  const t = now.getTime();
  const early = festival.earlybirdAt ? new Date(festival.earlybirdAt).getTime() : null;
  const regular = festival.regularAt ? new Date(festival.regularAt).getTime() : null;
  const late = festival.lateAt ? new Date(festival.lateAt).getTime() : null;

  if (late != null && t >= late) return "late";
  if (regular != null && t >= regular) return "regular";
  if (early != null && t >= early) return "earlybird";
  if (regular != null && t < regular) return "earlybird";
  return "regular";
}

export function feeForTier(
  category: { earlybirdFeeZar: number; regularFeeZar: number; lateFeeZar: number },
  tier: DeadlineTier,
): number {
  if (tier === "earlybird") return category.earlybirdFeeZar;
  if (tier === "late") return category.lateFeeZar || category.regularFeeZar;
  return category.regularFeeZar;
}

export function festivalAcceptsSubmissions(festival: {
  status: string;
  acceptingSubmissions: boolean;
}): boolean {
  if (!festival.acceptingSubmissions) return false;
  if (festival.status === FESTIVAL_STATUS.ENDED) return false;
  if (festival.status === FESTIVAL_STATUS.DRAFT) return false;
  if (festival.status === FESTIVAL_STATUS.SUBMISSIONS_CLOSED) return false;
  return festival.status === FESTIVAL_STATUS.LIVE;
}
