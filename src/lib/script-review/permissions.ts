import type { ReviewLayerId } from "./types";
import { REVIEW_LAYERS } from "./types";

export type ReviewCollaborationMode =
  | "owner"
  | "writer"
  | "producer"
  | "read_only"
  | "executive_reviewer";

export type ReviewPermissions = {
  mode: ReviewCollaborationMode;
  isAdmin: boolean;
  canAnnotate: boolean;
  canReply: boolean;
  canEditStatus: boolean;
  canExport: boolean;
  allowedLayers: ReviewLayerId[];
};

const ALL_LAYERS = REVIEW_LAYERS.map((l) => l.id);

const CORE_TEAM: ReviewCollaborationMode[] = ["owner", "writer", "producer", "executive_reviewer"];
const PRODUCER_TEAM: ReviewCollaborationMode[] = ["owner", "producer", "executive_reviewer"];
const OWNER_EXEC: ReviewCollaborationMode[] = ["owner", "executive_reviewer"];
const HOD_TEAM: ReviewCollaborationMode[] = ["owner", "writer", "producer", "executive_reviewer"];

/** Which collaboration modes may mark up each review layer. */
export const LAYER_ROLE_MATRIX: Record<ReviewLayerId, ReviewCollaborationMode[]> = {
  producer: CORE_TEAM,
  director: CORE_TEAM,
  writer: ["owner", "writer", "executive_reviewer"],
  legal: PRODUCER_TEAM,
  budget: PRODUCER_TEAM,
  executive: OWNER_EXEC,
  continuity: CORE_TEAM,
  ad: HOD_TEAM,
  dop: HOD_TEAM,
  production_design: HOD_TEAM,
  art: HOD_TEAM,
  costume: HOD_TEAM,
  hair_makeup: HOD_TEAM,
  gaffer: HOD_TEAM,
  sound: HOD_TEAM,
  locations: HOD_TEAM,
  stunts: HOD_TEAM,
  vfx: HOD_TEAM,
  editor: HOD_TEAM,
  production: HOD_TEAM,
};

export function resolveReviewCollaborationMode(input: {
  isAdmin: boolean;
  isOwner: boolean;
  memberRole: string | null;
  executiveReviewActive?: boolean;
}): ReviewCollaborationMode {
  if (input.isAdmin && input.executiveReviewActive) return "executive_reviewer";
  if (input.isAdmin) return "writer";
  if (input.isOwner) return "owner";
  const role = (input.memberRole ?? "").toLowerCase();
  if (role.includes("read") || role.includes("viewer")) return "read_only";
  if (role.includes("producer") && !role.includes("writer")) return "producer";
  return "writer";
}

export function buildReviewPermissions(input: {
  mode: ReviewCollaborationMode;
  isAdmin: boolean;
}): ReviewPermissions {
  const { mode, isAdmin } = input;
  const canAnnotate = mode !== "read_only";
  const canReply = mode !== "read_only";
  const canEditStatus = mode === "owner" || mode === "producer" || mode === "executive_reviewer" || isAdmin;
  const canExport = mode !== "read_only";

  const allowedLayers = ALL_LAYERS.filter((layer) =>
    LAYER_ROLE_MATRIX[layer].includes(mode),
  );

  return {
    mode,
    isAdmin,
    canAnnotate,
    canReply,
    canEditStatus,
    canExport,
    allowedLayers,
  };
}

export function canUseLayer(mode: ReviewCollaborationMode, layer: ReviewLayerId): boolean {
  return LAYER_ROLE_MATRIX[layer].includes(mode);
}
