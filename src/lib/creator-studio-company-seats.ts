import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

export function seatCapFromGoals(goals: string | null): number | null {
  const { meta } = parseEmbeddedMeta<{ teamSeatCap?: number }>(goals);
  const cap = meta?.teamSeatCap;
  if (typeof cap === "number" && Number.isFinite(cap)) {
    return Math.min(5, Math.max(1, Math.floor(cap)));
  }
  return null;
}
