import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  STORYBOARD_GUEST_COOKIE,
  isStoryboardInviteActive,
  newStoryboardGuestSessionToken,
} from "@/lib/storyboard/guest-access";

const db = prisma as any;

type RouteCtx = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const invite = await db.storyboardGuestInvite.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      boardId: true,
    },
  });

  if (!invite || !isStoryboardInviteActive(invite)) {
    return NextResponse.json({ error: "Invite is invalid or expired." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as
    | { guestName?: string; guestEmail?: string }
    | null;
  const guestName = body?.guestName?.trim();
  if (!guestName) {
    return NextResponse.json({ error: "guestName is required." }, { status: 400 });
  }

  const sessionToken = newStoryboardGuestSessionToken();
  const session = await db.storyboardGuestSession.create({
    data: {
      inviteId: invite.id,
      token: sessionToken,
      guestName,
      guestEmail: body?.guestEmail?.trim() || null,
      expiresAt: invite.expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(STORYBOARD_GUEST_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(invite.expiresAt ? { expires: invite.expiresAt } : { maxAge: 60 * 60 * 24 * 90 }),
  });

  return NextResponse.json({
    ok: true,
    boardId: invite.boardId,
    sessionId: session.id,
    guestName: session.guestName,
  });
}
