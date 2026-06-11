import "server-only";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";

export type ResolvedViewerProfile = {
  profileAge: number | null;
  viewerProfileId: string | null;
  profileName: string | null;
};

/** Resolve active viewer profile from cookie + age for catalogue filtering. */
export async function resolveViewerProfileContext(userId: string): Promise<ResolvedViewerProfile> {
  try {
    const cookieStore = await cookies();
    const profileId = cookieStore.get("st_viewer_profile")?.value;
    if (!profileId) {
      return { profileAge: null, viewerProfileId: null, profileName: null };
    }

    const profile = await prisma.viewerProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, name: true, age: true, dateOfBirth: true },
    });
    if (!profile) {
      return { profileAge: null, viewerProfileId: null, profileName: null };
    }

    return {
      profileAge: getViewerProfileAge(profile),
      viewerProfileId: profile.id,
      profileName: profile.name ?? null,
    };
  } catch {
    return { profileAge: null, viewerProfileId: null, profileName: null };
  }
}
