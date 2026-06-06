export type OriginalPitchStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "DECLINED";

/** Greenlit Story Time Original — only after admin approves the pitch package. */
export function isStoryTimeOriginalGreenlit(pitch?: { status: string } | null): boolean {
  return pitch?.status === "APPROVED";
}

/** Creator applied for the Originals program but is not greenlit yet. */
export function hasStoryTimeOriginalApplication(pitch?: { status: string } | null): boolean {
  if (!pitch || pitch.status === "DRAFT") return false;
  return pitch.status !== "APPROVED";
}

export function getStoryTimeOriginalBadge(pitch?: { status: string } | null): {
  label: string;
  tone: "greenlit" | "pending" | null;
} {
  if (isStoryTimeOriginalGreenlit(pitch)) {
    return { label: "Story Time Original", tone: "greenlit" };
  }
  if (hasStoryTimeOriginalApplication(pitch)) {
    return { label: "Originals application", tone: "pending" };
  }
  return { label: "", tone: null };
}
