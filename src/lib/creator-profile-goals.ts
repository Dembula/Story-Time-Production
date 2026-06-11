import { embedMeta, parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

/** Plain-text goals for display and editing (strips embedded registration metadata). */
export function displayCreatorGoals(goals: string | null | undefined): string {
  return parseEmbeddedMeta(goals).plain ?? "";
}

/** Preserve embedded registration metadata when saving profile goals from the UI. */
export function mergeCreatorGoalsForSave(
  existingGoals: string | null | undefined,
  plainGoals: string | null | undefined,
): string | null {
  const { meta } = parseEmbeddedMeta(existingGoals);
  const plain = plainGoals?.trim() || null;
  if (!meta && !plain) return null;
  return embedMeta(plain, meta as Record<string, unknown>);
}
