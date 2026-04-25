/** Structured JSON in NetworkPost.metadata */

export const NETWORK_POST_TYPES = [
  "TEXT_UPDATE",
  "VIDEO",
  "IMAGE",
  "COLLABORATION_REQUEST",
  "CASTING_CALL",
  "CREW_REQUEST",
  "FUNDING_UPDATE",
  "PROJECT_UPDATE",
] as const;

export type NetworkPostType = (typeof NETWORK_POST_TYPES)[number];

export type NetworkCollaborationPayload = {
  roleNeeded: string;
  requirements?: string;
  timeline?: string;
  location?: string;
  compensationSummary?: string;
  /** Optional link to CastingRole id for deep integration */
  castingRoleId?: string;
  /** Optional link to CrewRoleNeed id */
  crewRoleNeedId?: string;
};

export type NetworkPostMetadata = {
  taggedUserIds?: string[];
  fundingSourceId?: string;
  fundingNote?: string;
  collaboration?: NetworkCollaborationPayload;
};

export function parseNetworkPostMetadata(raw: string | null | undefined): NetworkPostMetadata {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as NetworkPostMetadata;
  } catch {
    return {};
  }
}

export function stringifyNetworkPostMetadata(meta: NetworkPostMetadata): string | null {
  if (!meta || Object.keys(meta).length === 0) return null;
  return JSON.stringify(meta);
}

export function computeReputationScore(input: {
  activeMemberships: number;
  followerCount: number;
  completedProjectsApprox: number;
}): number {
  const m = input.activeMemberships * 6;
  const f = input.followerCount * 2;
  const p = input.completedProjectsApprox * 10;
  return Math.round((m + f + p) * 10) / 10;
}
