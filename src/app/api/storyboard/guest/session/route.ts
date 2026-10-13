import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  STORYBOARD_GUEST_COOKIE,
  isStoryboardGuestSessionActive,
  isStoryboardInviteActive,
} from "@/lib/storyboard/guest-access";

const db = prisma as any;

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STORYBOARD_GUEST_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "No guest session." }, { status: 401 });
  }

  const session = await db.storyboardGuestSession.findUnique({
    where: { token },
    include: {
      invite: {
        include: {
          board: {
            include: {
              frames: { orderBy: { sortOrder: "asc" } },
              project: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    !isStoryboardGuestSessionActive(session) ||
    !isStoryboardInviteActive(session.invite)
  ) {
    return NextResponse.json({ error: "Guest session expired." }, { status: 401 });
  }

  await db.storyboardGuestSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  const board = session.invite.board;
  return NextResponse.json({
    guestName: session.guestName,
    board: {
      id: board.id,
      title: board.title,
      stylePreset: board.stylePreset,
      aspectRatio: board.aspectRatio,
      status: board.status,
      projectTitle: board.project.title,
      frames: board.frames.map(
        (f: {
          id: string;
          sceneNumber: string | null;
          sceneHeading: string | null;
          shotLabel: string | null;
          sortOrder: number;
          directorNotes: string | null;
          imageUrl: string | null;
          generationStatus: string;
        }) => ({
          id: f.id,
          sceneNumber: f.sceneNumber,
          sceneHeading: f.sceneHeading,
          shotLabel: f.shotLabel,
          sortOrder: f.sortOrder,
          directorNotes: f.directorNotes,
          imageUrl: f.imageUrl,
          generationStatus: f.generationStatus,
        }),
      ),
    },
  });
}
