export const VIEWER_PROFILE_COOKIE = "st_viewer_profile";
export const VIEWER_PROFILE_UNLOCK_COOKIE = "st_viewer_profile_unlock";

export const VIEWER_PROFILE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
/** Re-enter PIN after this window when the profile has PIN protection enabled. */
export const VIEWER_PROFILE_UNLOCK_MAX_AGE = 12 * 60 * 60;

export function viewerProfileCookieOptions(maxAge = VIEWER_PROFILE_COOKIE_MAX_AGE) {
  return {
    path: "/",
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };
}
