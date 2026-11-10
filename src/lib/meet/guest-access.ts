import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const MEET_GUEST_COOKIE = "st_meet_guest";

export async function getActiveMeetGuest(meetingId?: string) {
  const jar = await cookies();
  const token = jar.get(MEET_GUEST_COOKIE)?.value?.trim();
  if (!token) return null;

  const guest = await prisma.meetGuest.findUnique({
    where: { sessionToken: token },
    include: {
      meeting: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          hostUserId: true,
          waitingRoom: true,
          passcode: true,
        },
      },
    },
  });
  if (!guest || guest.leftAt) return null;
  if (meetingId && guest.meetingId !== meetingId) return null;
  if (guest.status === "DENIED") return null;
  return guest;
}

export function meetGuestCookieOptions(maxAgeSec = 60 * 60 * 12) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
