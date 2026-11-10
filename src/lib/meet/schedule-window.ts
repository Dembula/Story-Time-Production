/** Grace period after scheduled end before the Meet auto-ends. */
export const MEET_END_GRACE_MS = 15 * 60 * 1000;

export function meetGraceEndsAt(scheduledEndAt: Date | string): Date {
  const end = typeof scheduledEndAt === "string" ? new Date(scheduledEndAt) : scheduledEndAt;
  return new Date(end.getTime() + MEET_END_GRACE_MS);
}

export function isPastMeetScheduledEnd(scheduledEndAt: Date | string | null | undefined, now = Date.now()) {
  if (!scheduledEndAt) return false;
  const end = typeof scheduledEndAt === "string" ? new Date(scheduledEndAt) : scheduledEndAt;
  if (Number.isNaN(end.getTime())) return false;
  return now >= end.getTime();
}

export function shouldAutoEndMeet(scheduledEndAt: Date | string | null | undefined, now = Date.now()) {
  if (!scheduledEndAt) return false;
  const grace = meetGraceEndsAt(scheduledEndAt);
  if (Number.isNaN(grace.getTime())) return false;
  return now >= grace.getTime();
}
