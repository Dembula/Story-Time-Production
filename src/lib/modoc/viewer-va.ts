export const VIEWER_VA_ROLE = "SUBSCRIBER" as const;
export const VIEWER_VA_SCOPE = "browse" as const;

export function isViewerModocRoute(pathname: string): boolean {
  return pathname.startsWith("/browse") && !pathname.startsWith("/auth");
}

export function canShowViewerModoc(params: {
  sessionStatus: string;
  role?: string | null;
  pathname: string;
}): boolean {
  if (params.sessionStatus !== "authenticated") return false;
  if (params.role !== VIEWER_VA_ROLE) return false;
  return isViewerModocRoute(params.pathname);
}
