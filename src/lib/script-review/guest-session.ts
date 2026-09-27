import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SCRIPT_REVIEW_GUEST_COOKIE,
  isScriptGuestSessionActive,
  isScriptInviteActive,
} from "@/lib/script-review/guest-access";

export type ActiveScriptReviewGuest = {
  sessionId: string;
  sessionToken: string;
  guestName: string;
  guestEmail: string | null;
  inviteId: string;
  reviewSessionId: string;
  projectId: string;
  expiresAt: Date | null;
  inviterName: string | null;
};

export async function getActiveScriptReviewGuest(): Promise<ActiveScriptReviewGuest | null> {
  const jar = await cookies();
  const token = jar.get(SCRIPT_REVIEW_GUEST_COOKIE)?.value?.trim();
  if (!token) return null;

  const session = await prisma.scriptReviewGuestSession.findUnique({
    where: { token },
    include: {
      invite: {
        include: {
          createdBy: { select: { name: true, professionalName: true, email: true } },
          session: { select: { id: true, projectId: true } },
        },
      },
    },
  });
  if (!session) return null;
  if (!isScriptGuestSessionActive(session)) return null;
  if (!isScriptInviteActive(session.invite)) return null;

  await prisma.scriptReviewGuestSession
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
    reviewSessionId: session.invite.sessionId,
    projectId: session.invite.projectId || session.invite.session.projectId,
    expiresAt: session.expiresAt,
    inviterName: inviter,
  };
}
