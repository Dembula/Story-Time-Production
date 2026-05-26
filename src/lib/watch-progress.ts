import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const CONTINUE_WATCHING_MIN_SECONDS = 30;
export const CONTINUE_WATCHING_MAX_FRACTION = 0.92;

export async function getActiveViewerProfileId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const profileId = cookieStore.get("st_viewer_profile")?.value;
  if (!profileId) return null;
  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export function isContinueWatchingEligible(positionSeconds: number, durationSeconds: number | null): boolean {
  if (positionSeconds < CONTINUE_WATCHING_MIN_SECONDS) return false;
  if (!durationSeconds || durationSeconds <= 0) return true;
  return positionSeconds / durationSeconds < CONTINUE_WATCHING_MAX_FRACTION;
}
