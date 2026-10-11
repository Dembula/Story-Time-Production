/** Member statuses that grant tool / workspace access on a project. */
export const ACTIVE_PROJECT_MEMBER_STATUSES = ["ACTIVE", "ACCEPTED"] as const;

export type ActiveProjectMemberStatus = (typeof ACTIVE_PROJECT_MEMBER_STATUSES)[number];

const ACTIVE_SET = new Set<string>(ACTIVE_PROJECT_MEMBER_STATUSES);

/** True when the membership row can use project tools (owner invite accepted / active). */
export function isActiveProjectMemberStatus(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_SET.has(status));
}

/** Prisma `status: { in: [...] }` for active collaborators. */
export function activeProjectMemberStatusFilter(): {
  in: ActiveProjectMemberStatus[];
} {
  return { in: [...ACTIVE_PROJECT_MEMBER_STATUSES] };
}

/** Statuses that should appear in the My Projects invite inbox. */
export const PENDING_PROJECT_INVITE_STATUS = "INVITED" as const;

export function isPendingProjectInviteStatus(status: string | null | undefined): boolean {
  return status === PENDING_PROJECT_INVITE_STATUS;
}
