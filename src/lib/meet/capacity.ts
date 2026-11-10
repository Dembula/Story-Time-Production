import "server-only";

import { prisma } from "@/lib/prisma";
import { MEET_MAX_PARTICIPANTS } from "@/lib/meet/limits";

export { MEET_MAX_PARTICIPANTS };

export class MeetFullError extends Error {
  readonly code = "MEETING_FULL" as const;
  readonly capacity: number;
  readonly occupied: number;

  constructor(occupied: number, capacity = MEET_MAX_PARTICIPANTS) {
    super(
      `This Meet is full (${occupied}/${capacity}). Ask someone to leave, or try again later.`,
    );
    this.name = "MeetFullError";
    this.capacity = capacity;
    this.occupied = occupied;
  }
}

const STALE_MS = 90_000;

/** Drop ghost seats that stopped polling so capacity stays accurate. */
export async function pruneStaleMeetSeats(meetingId: string) {
  const cutoff = new Date(Date.now() - STALE_MS);
  await Promise.all([
    prisma.meetParticipant.updateMany({
      where: { meetingId, leftAt: null, lastSeenAt: { lt: cutoff } },
      data: { leftAt: new Date() },
    }),
    prisma.meetGuest.updateMany({
      where: {
        meetingId,
        leftAt: null,
        status: { in: ["ADMITTED", "WAITING"] },
        lastSeenAt: { lt: cutoff },
      },
      data: { leftAt: new Date(), status: "LEFT" },
    }),
  ]);
}

/** Active seats: signed-in participants still in-call + admitted guests. Waiting guests do not count. */
export async function countActiveMeetSeats(meetingId: string): Promise<number> {
  const [participants, guests] = await Promise.all([
    prisma.meetParticipant.count({
      where: { meetingId, leftAt: null },
    }),
    prisma.meetGuest.count({
      where: { meetingId, status: "ADMITTED", leftAt: null },
    }),
  ]);
  return participants + guests;
}

export async function getMeetCapacityState(meetingId: string) {
  const occupied = await countActiveMeetSeats(meetingId);
  return {
    occupied,
    capacity: MEET_MAX_PARTICIPANTS,
    remaining: Math.max(0, MEET_MAX_PARTICIPANTS - occupied),
    isFull: occupied >= MEET_MAX_PARTICIPANTS,
  };
}

/**
 * Throws MeetFullError when admitting a *new* seat would exceed capacity.
 * Pass `alreadySeated: true` when the caller is rejoining an existing open seat.
 */
export async function assertMeetHasCapacity(
  meetingId: string,
  options?: { alreadySeated?: boolean; prune?: boolean },
) {
  if (options?.prune !== false) {
    await pruneStaleMeetSeats(meetingId);
  }
  if (options?.alreadySeated) {
    return getMeetCapacityState(meetingId);
  }
  const state = await getMeetCapacityState(meetingId);
  if (state.isFull) {
    throw new MeetFullError(state.occupied, state.capacity);
  }
  return state;
}
