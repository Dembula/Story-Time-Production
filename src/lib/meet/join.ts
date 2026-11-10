import { prisma } from "@/lib/prisma";
import { generateMeetPeerId } from "@/lib/meet/codes";
import {
  MEET_MAX_PARTICIPANTS,
  MeetFullError,
  getMeetCapacityState,
  pruneStaleMeetSeats,
} from "@/lib/meet/capacity";

export async function joinMeetAsUser(options: {
  meetingId: string;
  userId: string;
  role?: "HOST" | "CO_HOST" | "PARTICIPANT";
  asHost?: boolean;
}) {
  const meeting = await prisma.meetMeeting.findUnique({ where: { id: options.meetingId } });
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.status === "ENDED") throw new Error("This meeting has ended");

  const role =
    options.asHost || meeting.hostUserId === options.userId
      ? "HOST"
      : options.role ?? "PARTICIPANT";

  const existing = await prisma.meetParticipant.findFirst({
    where: { meetingId: options.meetingId, userId: options.userId, leftAt: null },
  });
  if (existing) {
    const peerId = existing.peerId || generateMeetPeerId("u");
    const updated = await prisma.meetParticipant.update({
      where: { id: existing.id },
      data: {
        peerId,
        role: role === "HOST" ? "HOST" : existing.role,
        lastSeenAt: new Date(),
      },
    });
    if (meeting.status === "SCHEDULED") {
      await prisma.meetMeeting.update({
        where: { id: meeting.id },
        data: { status: "LIVE", startedAt: meeting.startedAt ?? new Date() },
      });
    }
    const capacity = await getMeetCapacityState(options.meetingId);
    return { participant: updated, meeting, role: updated.role, capacity };
  }

  await pruneStaleMeetSeats(options.meetingId);
  const peerId = generateMeetPeerId("u");
  const [participants, guests] = await Promise.all([
    prisma.meetParticipant.count({ where: { meetingId: options.meetingId, leftAt: null } }),
    prisma.meetGuest.count({
      where: { meetingId: options.meetingId, status: "ADMITTED", leftAt: null },
    }),
  ]);
  const occupied = participants + guests;
  if (occupied >= MEET_MAX_PARTICIPANTS) {
    throw new MeetFullError(occupied, MEET_MAX_PARTICIPANTS);
  }
  const participant = await prisma.meetParticipant.create({
    data: {
      meetingId: options.meetingId,
      userId: options.userId,
      role,
      peerId,
    },
  });

  if (meeting.status === "SCHEDULED") {
    await prisma.meetMeeting.update({
      where: { id: meeting.id },
      data: { status: "LIVE", startedAt: meeting.startedAt ?? new Date() },
    });
  }

  const capacity = await getMeetCapacityState(options.meetingId);
  return { participant, meeting, role, capacity };
}

export async function leaveMeetAsUser(meetingId: string, userId: string) {
  await prisma.meetParticipant.updateMany({
    where: { meetingId, userId, leftAt: null },
    data: { leftAt: new Date() },
  });
}

export async function leaveMeetAsGuest(guestId: string) {
  await prisma.meetGuest.update({
    where: { id: guestId },
    data: { leftAt: new Date(), status: "LEFT", lastSeenAt: new Date() },
  });
}
