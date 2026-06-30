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

/** Which collaboration modes may mark up each review layer. */
export const LAYER_ROLE_MATRIX: Record<ReviewLayerId, ReviewCollaborationMode[]> = {
  producer: ["owner", "writer", "producer", "executive_reviewer"],
  director: ["owner", "writer", "producer", "executive_reviewer"],
  writer: ["owner", "writer", "executive_reviewer"],
  legal: ["owner", "producer", "executive_reviewer"],
  budget: ["owner", "producer", "executive_reviewer"],
  executive: ["owner", "executive_reviewer"],
  continuity: ["owner", "writer", "producer", "executive_reviewer"],
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
