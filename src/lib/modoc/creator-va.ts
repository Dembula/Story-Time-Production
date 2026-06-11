export const CREATOR_VA_ROLE = "CONTENT_CREATOR" as const;
export const CREATOR_VA_LABEL = "Virtual Assistant (VA)";

export function isCreatorVaRoute(pathname: string): boolean {
  return pathname.startsWith("/creator") && !pathname.startsWith("/auth");
}

export function canShowCreatorVa(params: {
  sessionStatus: string;
  role?: string | null;
  pathname: string;
}): boolean {
  if (params.sessionStatus !== "authenticated") return false;
  if (params.role !== CREATOR_VA_ROLE) return false;
  return isCreatorVaRoute(params.pathname);
}
