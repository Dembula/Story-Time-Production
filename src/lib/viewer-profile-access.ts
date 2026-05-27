import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { prisma } from "@/lib/prisma";
import { VIEWER_PROFILE_UNLOCK_COOKIE } from "@/lib/viewer-profile-cookies";

export async function isViewerProfilePinUnlocked(
  userId: string,
  profileId: string,
  cookieStore: ReadonlyRequestCookies
): Promise<boolean> {
  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId },
    select: { pinEnabled: true },
  });
  if (!profile) return false;
  if (!profile.pinEnabled) return true;
  return cookieStore.get(VIEWER_PROFILE_UNLOCK_COOKIE)?.value === profileId;
}
