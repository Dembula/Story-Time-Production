import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  EDIT_REVIEW_GUEST_COOKIE,
  isInviteActive,
  isSessionActive,
} from "@/lib/edit-review/guest-access";

export type ActiveEditReviewGuest = {
  sessionId: string;
  sessionToken: string;
  guestName: string;
  guestEmail: string | null;
  inviteId: string;
  reviewId: string;
  projectId: string;
  expiresAt: Date | null;
  inviterName: string | null;
  reviewTitle: string | null;
};

export async function getActiveEditReviewGuest(): Promise<ActiveEditReviewGuest | null> {
  const jar = await cookies();
  const token = jar.get(EDIT_REVIEW_GUEST_COOKIE)?.value?.trim();
  if (!token) return null;

  const session = await prisma.editReviewGuestSession.findUnique({
    where: { token },
    include: {
      invite: {
        include: {
          createdBy: { select: { name: true, professionalName: true, email: true } },
          review: { select: { id: true, title: true, projectId: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (!isSessionActive(session)) return null;
  if (!isInviteActive(session.invite)) return null;

  await prisma.editReviewGuestSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});

  const inviter =
    session.invite.createdBy.professionalName?.trim() ||
    session.invite.createdBy.name?.trim() ||
    session.invite.createdBy.email?.split("@")[0] ||
    "A Story Time creator";

  return {
    sessionId: session.id,
    sessionToken: session.token,
    guestName: session.guestName,
    guestEmail: session.guestEmail,
    inviteId: session.inviteId,
    reviewId: session.invite.reviewId,
    projectId: session.invite.projectId || session.invite.review.projectId,
    expiresAt: session.expiresAt,
    inviterName: inviter,
    reviewTitle: session.invite.review.title,
  };
}
