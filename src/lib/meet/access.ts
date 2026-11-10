import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveMeetGuest } from "@/lib/meet/guest-access";

export type MeetIdentity =
  | {
      kind: "user";
      userId: string;
      name: string;
      email: string | null;
      peerId: string;
      role: string;
      participantId: string;
    }
  | {
      kind: "guest";
      guestId: string;
      name: string;
      peerId: string;
      status: string;
    };

export async function requireCreatorSession() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId) return null;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return null;
  }
  return {
    userId,
    role: role!,
    name: session?.user?.name ?? "Creator",
    email: session?.user?.email ?? null,
  };
}

export async function resolveMeetByIdOrCode(idOrCode: string) {
  const key = idOrCode.trim();
  if (!key) return null;
  return prisma.meetMeeting.findFirst({
    where: {
      OR: [{ id: key }, { code: key.toUpperCase() }, { code: key }],
    },
  });
}

/** Authenticated participant or admitted guest for RTC APIs. */
export async function resolveMeetRtcIdentity(meetingId: string): Promise<MeetIdentity | null> {
  const creator = await requireCreatorSession();
  if (creator) {
    const open = await prisma.meetParticipant.findFirst({
      where: { meetingId, userId: creator.userId, leftAt: null },
    });
    if (open?.peerId) {
      return {
        kind: "user",
        userId: creator.userId,
        name: creator.name,
        email: creator.email,
        peerId: open.peerId,
        role: open.role,
        participantId: open.id,
      };
    }
  }

  const guest = await getActiveMeetGuest(meetingId);
  if (guest?.peerId && (guest.status === "ADMITTED" || guest.status === "WAITING")) {
    return {
      kind: "guest",
      guestId: guest.id,
      name: guest.name,
      peerId: guest.peerId,
      status: guest.status,
    };
  }
  return null;
}

export async function isMeetHostOrCoHost(meetingId: string, userId: string) {
  const row = await prisma.meetParticipant.findFirst({
    where: {
      meetingId,
      userId,
      leftAt: null,
      role: { in: ["HOST", "CO_HOST"] },
    },
    select: { id: true, role: true },
  });
  if (row) return true;
  const meeting = await prisma.meetMeeting.findUnique({
    where: { id: meetingId },
    select: { hostUserId: true },
  });
  return meeting?.hostUserId === userId;
}
