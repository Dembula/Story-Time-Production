/** Safe internal redirect path from ?callbackUrl= (blocks open redirects). */
export function safeCallbackPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\") || trimmed.includes("\0")) return null;
  return trimmed;
}

export function isStudioTeamJoinCallback(path: string | null | undefined): boolean {
  return Boolean(path?.includes("/creator/join/company/"));
}

export function isProjectInviteJoinCallback(path: string | null | undefined): boolean {
  return Boolean(path?.includes("/creator/join/project/"));
}

export function isCreatorInviteJoinCallback(path: string | null | undefined): boolean {
  return isStudioTeamJoinCallback(path) || isProjectInviteJoinCallback(path);
}
